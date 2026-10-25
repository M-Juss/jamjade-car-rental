package com.jamjade.rcrecorder

import org.json.JSONObject

/** Local research contract. Preset facts come from native code, never editable client fields. */
internal object ResearchSetup {
  const val PRESET_ID = "mn82s_roof_v1"
  fun preset() = JSONObject().put("id", PRESET_ID).put("label", "MN-82S roof mount")
    .put("rc_model", "MN-82S Supertourer").put("mount_orientation", "tilted")
    .put("mount_location", "upper_roof").put("screen_facing", "up").put("phone_top_toward_rc_front", true)

  private fun fields(value: JSONObject, expected: Set<String>) {
    require(value.keys().asSequence().toSet() == expected) { "Recording setup fields are invalid" }
  }
  private fun text(value: JSONObject, field: String) {
    require(value.get(field) is String && value.getString(field).trim().length in 1..100)
    value.put(field, value.getString(field).trim())
  }
  private fun conditions(value: JSONObject) {
    listOf("surface", "slope", "mount_method").forEach { text(value, it) }
    require(value.getString("slope") in listOf("level", "uphill", "downhill"))
  }
  private fun purpose(value: JSONObject) {
    text(value, "recording_kind")
    require(value.getString("recording_kind") in listOf("maneuver_trial", "stationary_reference", "forward_reference"))
  }
  fun group(value: JSONObject): JSONObject {
    fields(value, setOf("name", "surface", "slope", "mount_method", "recording_kind"))
    text(value, "name"); conditions(value); purpose(value)
    return value
  }
  fun recording(value: JSONObject, group: JSONObject): JSONObject {
    fields(value, setOf("recording_group_id", "surface", "slope", "mount_method", "recording_kind", "consent"))
    require(value.get("recording_group_id") is String && value.getString("recording_group_id") == group.getString("id"))
    require(group.getString("preset_id") == PRESET_ID)
    conditions(value); purpose(value)
    require(value.get("consent") is Boolean && value.getBoolean("consent")) { "Agree to recording before starting" }
    return value.put("preset_id", PRESET_ID).put("recording_group_name", group.getString("name"))
      .put("rc_model", "MN-82S Supertourer").put("mount_orientation", "tilted").put("mount_location", "upper_roof")
      .put("screen_facing", "up").put("phone_top_toward_rc_front", true)
      .put("mount_angle_degrees", JSONObject.NULL).put("mount_angle_source", "not_measured")
      .put("battery_condition", JSONObject.NULL).put("rc_battery_source", "not_measured")
  }
}
