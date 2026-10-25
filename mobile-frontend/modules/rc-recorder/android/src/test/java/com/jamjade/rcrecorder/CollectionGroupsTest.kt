package com.jamjade.rcrecorder

import java.io.IOException
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

class CollectionGroupsTest {
  private class Disk {
    var saved = """{"format_version":1,"groups":{},"selected_group_id":null}"""
    var fail = false
    fun open() = CollectionGroups({ JSONObject(saved) }, { value ->
      if (fail) throw IOException("Synthetic disk failure")
      saved = value.toString()
    })
  }
  private fun defaults() = ResearchSetup.group(JSONObject("""{"name":"Synthetic tile trials","surface":"Tiles","slope":"level","mount_method":"Synthetic clamp","recording_kind":"stationary_reference"}"""))
  private fun capture(id: String) = JSONObject().put("recording_group_id", id).put("surface", "Smooth concrete")
    .put("slope", "level").put("mount_method", "Synthetic straps").put("recording_kind", "stationary_reference").put("consent", true)

  @Test fun groupIdentityAndNumberingSurviveReopeningTheSavedIndex() {
    val disk = Disk()
    val group = disk.open().create(defaults(), "2026-10-25T00:00:00.000Z")
    val id = group.getString("id")
    assertEquals(id, disk.open().catalog().getString("selected_group_id"))
    assertEquals("Tiles", disk.open().group(id).getJSONObject("defaults").getString("surface"))
    assertEquals("stationary_reference", disk.open().group(id).getJSONObject("defaults").getString("recording_kind"))
    assertEquals(Pair("Synthetic tile trials · Recording 001", 1L), disk.open().allocate(id))
    assertEquals(Pair("Synthetic tile trials · Recording 002", 2L), disk.open().allocate(id))
    assertEquals(3L, disk.open().group(id).getLong("next_recording_number"))
  }

  @Test fun failedCommitNeverReturnsAnAllocatedNumber() {
    val disk = Disk()
    val id = disk.open().create(defaults(), "2026-10-25T00:00:00.000Z").getString("id")
    disk.fail = true
    assertThrows(IOException::class.java) { disk.open().allocate(id) }
    disk.fail = false
    assertEquals(1L, disk.open().allocate(id).second)
  }

  @Test fun groupsAreOwnerBoundAndDuplicateNamesDoNotCreateAnotherIdentity() {
    val disk = Disk()
    val id = disk.open().create(defaults(), "2026-10-25T00:00:00.000Z").getString("id")
    assertThrows(IOException::class.java) { Disk().open().group(id) }
    assertThrows(IllegalArgumentException::class.java) {
      disk.open().create(defaults().put("name", "synthetic TILE trials"), "2026-10-25T00:00:01.000Z")
    }
    assertEquals(1, disk.open().catalog().getJSONArray("groups").length())
  }

  @Test fun recordingEditsAreSnapshotsAndUnknownMeasurementsStayUnknown() {
    val disk = Disk()
    val group = disk.open().create(defaults(), "2026-10-25T00:00:00.000Z")
    val result = ResearchSetup.recording(capture(group.getString("id")), group)
    assertEquals("Smooth concrete", result.getString("surface"))
    assertEquals("Tiles", disk.open().group(group.getString("id")).getJSONObject("defaults").getString("surface"))
    assertEquals("MN-82S Supertourer", result.getString("rc_model"))
    assertEquals("tilted", result.getString("mount_orientation"))
    assertTrue(result.isNull("mount_angle_degrees"))
    assertTrue(result.isNull("battery_condition"))
    assertEquals("not_measured", result.getString("mount_angle_source"))
  }

  @Test fun clientCannotOverrideTheLockedProfileOrSupplyGuessedAngleAndBattery() {
    val disk = Disk()
    val group = disk.open().create(defaults(), "2026-10-25T00:00:00.000Z")
    for (field in listOf("rc_model", "mount_orientation", "mount_angle_degrees", "battery_condition")) {
      assertThrows(IllegalArgumentException::class.java) {
        ResearchSetup.recording(capture(group.getString("id")).put(field, "Synthetic override"), group)
      }
    }
    assertThrows(IllegalArgumentException::class.java) {
      ResearchSetup.recording(capture(group.getString("id")).put("consent", "true"), group)
    }
  }
}
