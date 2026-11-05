package com.jamjade.rcrecorder

import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID

/** Encrypted metadata only. Never alters a sealed protocol-2 manifest. All calls run on the recorder actor. */
internal class CollectionWorkflow(private val read: () -> JSONObject, private val commit: (JSONObject) -> Unit) {
  companion object {
    const val VERSION = "rc-collection-v1"
    const val CATALOG = "rc-exercises-v1"
    fun code(session: Long, exercise: String, capture: Long) = "S${session.toString().padStart(2, '0')}-$exercise-R${capture.toString().padStart(3, '0')}"
  }
  fun current(): JSONObject = read()
  fun open(group: JSONObject, now: String): JSONObject {
    val index = read()
    val number = index.optLong("next_session_number", 1)
    require(number in 1..999999999L)
    val session = JSONObject().put("id", UUID.randomUUID().toString())
      .put("device_profile_id", index.getString("device_profile_id")).put("session_number", number)
      .put("recording_group_id", group.getString("id")).put("opened_at", now)
      .put("conditions", JSONObject().put("surface", group.getJSONObject("defaults").getString("surface"))
        .put("slope", group.getJSONObject("defaults").getString("slope")))
      .put("preset_id", ResearchSetup.PRESET_ID).put("catalog_version", CATALOG).put("operator_code", "OP01")
    index.put("session", session).put("mount", mountDocument(session, 1, "initial", now)).put("next_session_number", number + 1)
    commit(index)
    return index
  }
  fun mount(reason: String, now: String): JSONObject {
    require(reason in setOf("initial", "remounted", "repositioned", "suspected_shift"))
    val index = read()
    val session = index.getJSONObject("session")
    val number = (index.optJSONObject("mount")?.getLong("mount_number") ?: 0) + 1
    require(number < 1000000)
    index.put("mount", mountDocument(session, number, reason, now))
    commit(index)
    return index
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
    require(input.keys().asSequence().toSet() == setOf("base_revision", "completed_as_planned", "source", "observer_code", "flags", "actual_stop_method", "notes"))
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
