package com.jamjade.rcrecorder

import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException
import java.util.UUID

/** Group identity and numbering are independent of the live physical-session UUID. */
internal class CollectionGroups(private val read: () -> JSONObject, private val commit: (JSONObject) -> Unit) {
  fun catalog(): JSONObject {
    val index = read()
    val groups = index.getJSONObject("groups")
    val ordered = groups.keys().asSequence().map { groups.getJSONObject(it) }.sortedByDescending { it.getString("created_at_utc") }.toList()
    return JSONObject().put("groups", JSONArray(ordered)).put("selected_group_id", index.opt("selected_group_id"))
      .put("preset", ResearchSetup.preset())
  }
  fun create(values: JSONObject, createdAt: String): JSONObject {
    val index = read()
    val groups = index.getJSONObject("groups")
    require(groups.length() < 50) { "Local collection group limit reached" }
    require(groups.keys().asSequence().none { groups.getJSONObject(it).getString("name").equals(values.getString("name"), true) }) {
      "A collection group with this name already exists"
    }
    val id = UUID.randomUUID().toString()
    val defaults = JSONObject().put("surface", values.getString("surface")).put("slope", values.getString("slope"))
      .put("mount_method", values.getString("mount_method")).put("recording_kind", values.getString("recording_kind"))
    val group = JSONObject().put("id", id).put("name", values.getString("name")).put("preset_id", ResearchSetup.PRESET_ID)
      .put("created_at_utc", createdAt).put("defaults", defaults).put("next_recording_number", 1)
    groups.put(id, group); index.put("selected_group_id", id)
    commit(index)
    return group
  }
  fun group(id: String): JSONObject {
    require(Regex("[0-9a-f-]{36}").matches(id)) { "Select a collection group" }
    return read().getJSONObject("groups").optJSONObject(id) ?: throw IOException("Collection group is unavailable")
  }
  /** Commit before starting capture. Failed starts may leave a gap; successful numbers cannot be reused. */
  fun allocate(groupId: String): Pair<String, Long> {
    val index = read()
    val group = index.getJSONObject("groups").getJSONObject(groupId)
    val number = group.getLong("next_recording_number")
    require(number in 1..999999999L)
    group.put("next_recording_number", number + 1); index.put("selected_group_id", groupId)
    commit(index)
    return Pair("${group.getString("name")} · Recording ${number.toString().padStart(3, '0')}", number)
  }
}
