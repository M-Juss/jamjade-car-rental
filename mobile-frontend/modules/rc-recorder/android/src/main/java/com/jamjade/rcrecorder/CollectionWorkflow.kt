package com.jamjade.rcrecorder

import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID

/** Encrypted metadata only. Never alters a sealed protocol-2 manifest. All calls run on the recorder actor. */
internal class CollectionWorkflow(
  private val read: () -> JSONObject,
  private val commit: (JSONObject) -> Unit,
  private val hasRecording: (String) -> Boolean = { false },
) {
  companion object {
    const val VERSION = "rc-collection-v1"
    const val CATALOG = "rc-exercises-v3"
    fun code(session: Long, exercise: String, capture: Long) = "S${session.toString().padStart(2, '0')}-$exercise-R${capture.toString().padStart(3, '0')}"
  }
  /** Older installations have only the active session; preserve it on first use. */
  private fun index(): JSONObject {
    val index = read()
    if (!index.has("sessions_by_group")) index.put("sessions_by_group", JSONObject())
    if (!index.has("mount_generation")) index.put("mount_generation", 0)
    val session = index.optJSONObject("session")
    if (session != null && !index.getJSONObject("sessions_by_group").has(session.getString("recording_group_id"))) {
      remember(index)
    }
    return index
  }
  private fun recorded(block: JSONObject): Boolean = block.optBoolean("has_recordings") ||
    hasRecording(block.getJSONObject("session").getString("id"))
  private fun remember(index: JSONObject) {
    val session = index.getJSONObject("session")
    val blocks = index.getJSONObject("sessions_by_group")
    val previous = blocks.optJSONObject(session.getString("recording_group_id"))
    val used = previous != null && previous.optJSONObject("session")?.optString("id") == session.getString("id") && previous.optBoolean("has_recordings")
    blocks.put(session.getString("recording_group_id"), JSONObject().put("session", session)
      .put("mount", index.getJSONObject("mount")).put("mount_generation", index.getLong("mount_generation"))
      .put("has_recordings", used || hasRecording(session.getString("id"))))
  }
  private fun withRecordingState(index: JSONObject): JSONObject {
    val result = JSONObject(index.toString())
    val summaries = JSONObject()
    val blocks = index.getJSONObject("sessions_by_group")
    blocks.keys().asSequence().forEach { groupId ->
      val block = blocks.getJSONObject(groupId)
      summaries.put(groupId, JSONObject().put("session", block.getJSONObject("session"))
        .put("session_has_recordings", recorded(block)))
    }
    result.put("group_sessions", summaries)
    index.optJSONObject("session")?.let { result.put("session_has_recordings", summaries.getJSONObject(it.getString("recording_group_id")).getBoolean("session_has_recordings")) }
    return result
  }
  fun current(): JSONObject {
    val index = index()
    val blocks = index.getJSONObject("sessions_by_group")
    var changed = false
    blocks.keys().asSequence().forEach { id ->
      val block = blocks.getJSONObject(id)
      if (!block.optBoolean("has_recordings") && hasRecording(block.getJSONObject("session").getString("id"))) {
        block.put("has_recordings", true); changed = true
      }
    }
    if (changed) commit(index)
    return withRecordingState(index)
  }
  fun open(group: JSONObject, now: String): JSONObject {
    val index = index()
    val block = index.getJSONObject("sessions_by_group").optJSONObject(group.getString("id"))
    return if (block != null) activate(index, block, now) else createSession(index, group, now)
  }
  fun newSession(group: JSONObject, now: String): JSONObject {
    val index = index()
    val block = index.getJSONObject("sessions_by_group").optJSONObject(group.getString("id"))
    if (block != null && !recorded(block)) return activate(index, block, now)
    return createSession(index, group, now)
  }
  private fun activate(index: JSONObject, block: JSONObject, now: String): JSONObject {
    val session = block.getJSONObject("session")
    val mount = block.getJSONObject("mount")
    require(mount.getString("research_session_id") == session.getString("id")) { "Session setup is incomplete" }
    if (index.optJSONObject("session")?.optString("id") == session.getString("id")) return withRecordingState(index)
    if (index.has("session")) remember(index)
    index.put("session", session).put("mount", mount)
    if (block.getLong("mount_generation") != index.getLong("mount_generation")) {
      // A declared remount in another group invalidates this older physical frame.
      val number = mount.getLong("mount_number") + 1
      require(number < 1000000)
      index.put("mount", mountDocument(session, number, "suspected_shift", now))
    }
    remember(index)
    commit(index)
    return withRecordingState(index)
  }
  private fun createSession(index: JSONObject, group: JSONObject, now: String): JSONObject {
    if (index.has("session")) remember(index)
    val number = index.optLong("next_session_number", 1)
    require(number in 1..999999999L)
    val session = JSONObject().put("id", UUID.randomUUID().toString())
      .put("device_profile_id", index.getString("device_profile_id")).put("session_number", number)
      .put("recording_group_id", group.getString("id")).put("opened_at", now)
      .put("conditions", JSONObject().put("surface", group.getJSONObject("defaults").getString("surface"))
        .put("slope", group.getJSONObject("defaults").getString("slope")))
      .put("preset_id", ResearchSetup.PRESET_ID).put("catalog_version", CATALOG).put("operator_code", "OP01")
    index.put("session", session).put("mount", mountDocument(session, 1, "initial", now)).put("next_session_number", number + 1)
    remember(index)
    commit(index)
    return withRecordingState(index)
  }
  fun mount(reason: String, now: String): JSONObject {
    require(reason in setOf("initial", "remounted", "repositioned", "suspected_shift"))
    val index = index()
    val session = index.getJSONObject("session")
    val number = (index.optJSONObject("mount")?.getLong("mount_number") ?: 0) + 1
    require(number < 1000000)
    index.put("mount", mountDocument(session, number, reason, now))
      .put("mount_generation", index.getLong("mount_generation") + 1)
    remember(index)
    commit(index)
    return withRecordingState(index)
  }
  fun recordingSaved(sessionId: String) {
    val index = index()
    val blocks = index.getJSONObject("sessions_by_group")
    val block = blocks.keys().asSequence().map { blocks.getJSONObject(it) }
      .firstOrNull { it.getJSONObject("session").getString("id") == sessionId } ?: return
    // Also persist an older installation's lazily imported active session.
    block.put("has_recordings", true)
    commit(index)
  }
  private fun mountDocument(session: JSONObject, number: Long, reason: String, now: String) = JSONObject()
    .put("id", UUID.randomUUID().toString()).put("research_session_id", session.getString("id"))
    .put("mount_number", number).put("reason", reason).put("created_at", now)
    .put("preset_id", ResearchSetup.PRESET_ID).put("alignment_status", "pending")
  fun bind(recordingId: String, capture: Long, protocol: JSONObject, preflight: JSONObject): JSONObject {
    val index = read()
    val session = index.getJSONObject("session")
    val mount = index.getJSONObject("mount")
    require(preflight.getString("mount_version_id") == mount.getString("id")) { "Repeat setup checks after a remount" }
    return JSONObject().put("contract_version", VERSION).put("session", session).put("mount", mount)
      .put("recording_id", recordingId).put("capture_number", capture).put("preflight", preflight)
      .put("protocol_code", protocol.getString("code")).put("catalog_version", CATALOG)
      .put("protocol_sha256", RecorderStore.hash(RecorderStore.canonical(protocol).toByteArray(Charsets.UTF_8)))
      .put("display_code", code(session.getLong("session_number"), protocol.getString("code"), capture))
      .put("protocol_snapshot", protocol).put("capture_stage", "pilot")
      .put("course_snapshot", JSONObject().put("layout_key", protocol.getString("layout_key"))
        .put("layout_revision", 1).put("status", "provisional").put("spacing_m", JSONObject.NULL).put("radius_m", JSONObject.NULL))
  }
  fun observe(previous: JSONObject?, input: JSONObject, now: String): JSONObject {
    val required = setOf("base_revision", "completed_as_planned", "source", "observer_code", "flags", "actual_stop_method", "notes")
    val keys = input.keys().asSequence().toSet()
    require(keys == required || keys == required + "initial_deviation")
    if (input.has("initial_deviation")) {
      require(previous?.optString("protocol_code") == "SW")
      require(input.get("initial_deviation") in setOf("left", "right", "unknown"))
    }
    val revisions = previous?.optJSONArray("observations") ?: JSONArray()
    require(input.getInt("base_revision") == revisions.length()) { "Observations changed. Reopen the recording." }
    require(revisions.length() < 100) { "Observation revision limit reached" }
    require(input.isNull("completed_as_planned") || input.get("completed_as_planned") is Boolean)
    require(input.getString("source") in setOf("observed", "operator_report", "signal_review"))
    require(input.isNull("observer_code") || Regex("OB[0-9]{2,4}").matches(input.getString("observer_code")))
    require(input.getString("source") != "observed" || !input.isNull("observer_code"))
    val flags = input.getJSONArray("flags")
    val allowed = setOf("steering_corrections", "unexpected_reverse", "unexpected_turn", "bump", "cone_contact", "phone_shift", "holder_loose", "interrupted", "not_sure")
    val names = (0 until flags.length()).map { flags.getString(it) }
    require(names.size <= allowed.size && names.toSet().size == names.size && names.all { it in allowed })
    require(input.getString("actual_stop_method") in setOf("brake_applied", "neutral_release", "unknown", "not_applicable"))
    require(input.isNull("notes") || input.getString("notes").length <= 1000)
    val revision = JSONObject(input.toString()).apply { remove("base_revision") }
      .put("id", UUID.randomUUID().toString()).put("revision", revisions.length() + 1).put("reported_at", now)
    revisions.put(revision)
    return (previous ?: JSONObject()).put("observations", revisions)
  }
}
