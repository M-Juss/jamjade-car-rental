package com.jamjade.rcrecorder

import org.json.JSONObject
import org.json.JSONArray
import org.junit.Assert.*
import org.junit.Test
import java.io.IOException

class CollectionWorkflowTest {
  private class Disk {
    var saved = """{"device_profile_id":"00000000-0000-4000-8000-000000000001","next_session_number":1}"""
    var fail = false
    val recorded = mutableSetOf<String>()
    fun record() { recorded.add(JSONObject(saved).getJSONObject("session").getString("id")) }
    fun open() = CollectionWorkflow({ JSONObject(saved) }, { value ->
      if (fail) throw IOException("Synthetic failure")
      saved = value.toString()
    }, { it in recorded })
  }
  private fun group() = JSONObject("""{"id":"00000000-0000-4000-8000-000000000002","defaults":{"surface":"Tiles","slope":"level"}}""")
  @Test fun sessionNumbersSurviveReopeningAndRemountKeepsSessionIdentity() {
    val disk = Disk(); val first = disk.open().open(group(), "2026-11-06T00:00:00Z")
    val remount = disk.open().mount("remounted", "2026-11-06T00:01:00Z")
    assertEquals(first.getJSONObject("session").getString("id"), remount.getJSONObject("session").getString("id"))
    assertNotEquals(first.getJSONObject("mount").getString("id"), remount.getJSONObject("mount").getString("id"))
    assertEquals(2, remount.getJSONObject("mount").getInt("mount_number"))
    assertEquals("pending", remount.getJSONObject("mount").getString("alignment_status"))
    val resumed = disk.open().open(group(), "2026-11-06T00:02:00Z")
    assertEquals(1, resumed.getJSONObject("session").getInt("session_number"))
    assertEquals(remount.getJSONObject("mount").getString("id"), resumed.getJSONObject("mount").getString("id"))
    disk.record()
    assertEquals(2, disk.open().newSession(group(), "2026-11-06T00:03:00Z").getJSONObject("session").getInt("session_number"))
  }
  @Test fun repeatedlyOpeningAnEmptySessionDoesNotAllocateOrWrite() {
    val disk = Disk()
    val first = disk.open().open(group(), "2026-11-06T00:00:00Z")
    val saved = disk.saved
    disk.fail = true // A resume must not even attempt a commit.
    repeat(10) {
      val resumed = disk.open().open(group(), "2026-11-06T00:01:00Z")
      assertEquals(first.getJSONObject("session").getString("id"), resumed.getJSONObject("session").getString("id"))
      assertEquals(first.getJSONObject("mount").getString("id"), resumed.getJSONObject("mount").getString("id"))
      assertEquals(2, resumed.getInt("next_session_number"))
      assertEquals(saved, disk.saved)
    }
  }
  @Test fun anotherGroupStartsANewSessionAndExplicitCreationPreservesNumbering() {
    val disk = Disk()
    disk.open().open(group(), "2026-11-06T00:00:00Z")
    val other = group().put("id", "00000000-0000-4000-8000-000000000003")
    val second = disk.open().open(other, "2026-11-06T00:01:00Z")
    assertEquals(2, second.getJSONObject("session").getInt("session_number"))
    assertEquals(1, second.getJSONObject("mount").getInt("mount_number"))
    disk.record()
    val third = disk.open().newSession(other, "2026-11-06T00:02:00Z")
    assertEquals(3, third.getJSONObject("session").getInt("session_number"))
    assertNotEquals(second.getJSONObject("session").getString("id"), third.getJSONObject("session").getString("id"))
  }
  @Test fun failedExplicitCreationKeepsTheCurrentSessionAndCounter() {
    val disk = Disk()
    disk.open().open(group(), "2026-11-06T00:00:00Z")
    disk.record()
    val saved = disk.saved
    disk.fail = true
    assertThrows(IOException::class.java) { disk.open().newSession(group(), "2026-11-06T00:01:00Z") }
    assertEquals(saved, disk.saved)
    disk.fail = false
    assertEquals(2, disk.open().newSession(group(), "2026-11-06T00:02:00Z").getJSONObject("session").getInt("session_number"))
  }
  @Test fun requestingAnotherEmptySessionKeepsTheExistingOneWithoutWriting() {
    val disk = Disk()
    val first = disk.open().open(group(), "2026-11-06T00:00:00Z")
    val saved = disk.saved
    disk.fail = true
    repeat(5) {
      val result = disk.open().newSession(group(), "2026-11-06T00:01:00Z")
      assertEquals(first.getJSONObject("session").getString("id"), result.getJSONObject("session").getString("id"))
      assertFalse(result.getBoolean("session_has_recordings"))
      assertEquals(2, result.getInt("next_session_number"))
      assertEquals(saved, disk.saved)
    }
  }
  @Test fun sessionStateReflectsSavedRecordingEvidence() {
    val disk = Disk()
    disk.open().open(group(), "2026-11-06T00:00:00Z")
    assertFalse(disk.open().current().getBoolean("session_has_recordings"))
    disk.record()
    assertTrue(disk.open().current().getBoolean("session_has_recordings"))
    val next = disk.open().newSession(group(), "2026-11-06T00:01:00Z")
    assertEquals(2, next.getJSONObject("session").getInt("session_number"))
    assertFalse(next.getBoolean("session_has_recordings"))
  }
  @Test fun switchingGroupsAndRestartingResumesEachLatestSessionWithoutAllocating() {
    val disk = Disk()
    val first = disk.open().open(group(), "2026-11-06T00:00:00Z")
    val other = group().put("id", "00000000-0000-4000-8000-000000000003")
    val second = disk.open().open(other, "2026-11-06T00:01:00Z")
    val restored = disk.open().open(group(), "2026-11-06T00:02:00Z")
    assertEquals(first.getJSONObject("session").getString("id"), restored.getJSONObject("session").getString("id"))
    assertEquals(first.getJSONObject("mount").getString("id"), restored.getJSONObject("mount").getString("id"))
    assertEquals(3, restored.getInt("next_session_number"))
    val returned = disk.open().newSession(other, "2026-11-06T00:03:00Z")
    assertEquals(second.getJSONObject("session").getString("id"), returned.getJSONObject("session").getString("id"))
    assertEquals(3, returned.getInt("next_session_number"))
    assertEquals(2, returned.getJSONObject("group_sessions").length())
  }
  @Test fun returningAfterRemountElsewhereKeepsSessionButInvalidatesOldMountOnce() {
    val disk = Disk()
    val first = disk.open().open(group(), "2026-11-06T00:00:00Z")
    val other = group().put("id", "00000000-0000-4000-8000-000000000003")
    disk.open().open(other, "2026-11-06T00:01:00Z")
    disk.open().mount("remounted", "2026-11-06T00:02:00Z")
    val restored = disk.open().open(group(), "2026-11-06T00:03:00Z")
    assertEquals(first.getJSONObject("session").getString("id"), restored.getJSONObject("session").getString("id"))
    assertNotEquals(first.getJSONObject("mount").getString("id"), restored.getJSONObject("mount").getString("id"))
    assertEquals("suspected_shift", restored.getJSONObject("mount").getString("reason"))
    assertEquals(2, restored.getJSONObject("mount").getInt("mount_number"))
    assertEquals("pending", restored.getJSONObject("mount").getString("alignment_status"))
    assertEquals(restored.getJSONObject("mount").getString("id"), disk.open().open(group(), "2026-11-06T00:04:00Z").getJSONObject("mount").getString("id"))
  }
  @Test fun failedGroupActivationDoesNotChangeCurrentSessionOrCounter() {
    val disk = Disk()
    disk.open().open(group(), "2026-11-06T00:00:00Z")
    val other = group().put("id", "00000000-0000-4000-8000-000000000003")
    disk.open().open(other, "2026-11-06T00:01:00Z")
    val saved = disk.saved
    disk.fail = true
    assertThrows(IOException::class.java) { disk.open().open(group(), "2026-11-06T00:02:00Z") }
    assertEquals(saved, disk.saved)
  }
  @Test fun olderActiveSessionMigratesWithoutRenumberingOrLosingMount() {
    val disk = Disk()
    val first = disk.open().open(group(), "2026-11-06T00:00:00Z")
    val legacy = JSONObject(disk.saved).apply { remove("sessions_by_group"); remove("mount_generation") }
    disk.saved = legacy.toString()
    val restored = disk.open().open(group(), "2026-11-06T00:01:00Z")
    assertEquals(first.getJSONObject("session").toString(), restored.getJSONObject("session").toString())
    assertEquals(first.getJSONObject("mount").toString(), restored.getJSONObject("mount").toString())
    assertEquals(2, restored.getInt("next_session_number"))
  }
  @Test fun deletingLocalRecordingEvidenceDoesNotTurnUsedSessionIntoAnEmptyOne() {
    val disk = Disk()
    val first = disk.open().open(group(), "2026-11-06T00:00:00Z")
    val id = first.getJSONObject("session").getString("id")
    disk.record()
    disk.open().recordingSaved(id)
    disk.recorded.clear()
    assertTrue(disk.open().current().getBoolean("session_has_recordings"))
    assertEquals(2, disk.open().newSession(group(), "2026-11-06T00:01:00Z").getJSONObject("session").getInt("session_number"))
  }
  @Test fun failedCommitDoesNotAllocateASession() {
    val disk = Disk(); disk.fail = true
    assertThrows(IOException::class.java) { disk.open().open(group(), "2026-11-06T00:00:00Z") }
    disk.fail = false
    assertEquals(1, disk.open().open(group(), "2026-11-06T00:00:00Z").getJSONObject("session").getInt("session_number"))
  }
  @Test fun aliasesExpandWithoutTruncatingNumbers() {
    assertEquals("S02-FSS-R038", CollectionWorkflow.code(2, "FSS", 38))
    assertEquals("S120-RSS-R1001", CollectionWorkflow.code(120, "RSS", 1001))
  }
  @Test fun evidenceCannotCrossDeclaredMounts() {
    val disk = Disk(); val state = disk.open().open(group(), "2026-11-06T00:00:00Z")
    val evidence = JSONObject().put("mount_version_id", state.getJSONObject("mount").getString("id"))
    disk.open().mount("remounted", "2026-11-06T00:01:00Z")
    assertThrows(IllegalArgumentException::class.java) { disk.open().bind("synthetic", 38, JSONObject().put("code", "FR"), evidence) }
  }
  private fun report(base: Int) = JSONObject().put("base_revision", base).put("completed_as_planned", JSONObject.NULL)
    .put("source", "operator_report").put("observer_code", JSONObject.NULL).put("flags", JSONArray(listOf("steering_corrections")))
    .put("actual_stop_method", "unknown").put("notes", JSONObject.NULL)

  @Test fun initialDeviationIsStoredOnlyForSwerveObservations() {
    val workflow = Disk().open()
    val time = "2026-11-06T00:00:00Z"
    val input = report(0).put("initial_deviation", "left")
    assertThrows(IllegalArgumentException::class.java) {
      workflow.observe(JSONObject().put("protocol_code", "FSS"), input, time)
    }
    assertThrows(IllegalArgumentException::class.java) {
      workflow.observe(JSONObject().put("protocol_code", "SW"), report(0).put("initial_deviation", "forward"), time)
    }
    val saved = workflow.observe(JSONObject().put("protocol_code", "SW"), input, time)
    assertEquals("left", saved.getJSONArray("observations").getJSONObject(0).getString("initial_deviation"))
    val updated = workflow.observe(saved, report(1).put("initial_deviation", "right"), time)
    val revisions = updated.getJSONArray("observations")
    assertEquals("left", revisions.getJSONObject(0).getString("initial_deviation"))
    assertEquals("right", revisions.getJSONObject(1).getString("initial_deviation"))
  }
  @Test fun observationsAppendAndStaleEditsCannotOverwriteHistory() {
    val workflow = Disk().open(); val saved = workflow.observe(null, report(0), "2026-11-06T00:00:00Z")
    assertEquals(1, saved.getJSONArray("observations").length())
    assertThrows(IllegalArgumentException::class.java) { workflow.observe(saved, report(0), "2026-11-06T00:00:01Z") }
    val next = workflow.observe(saved, report(1), "2026-11-06T00:00:02Z")
    assertEquals(2, next.getJSONArray("observations").length())
    assertTrue(next.getJSONArray("observations").getJSONObject(0).isNull("completed_as_planned"))
  }
  @Test fun unknownAndDuplicateFlagsAreRejected() {
    for (names in listOf(listOf("normal"), listOf("bump", "bump"))) {
      assertThrows(IllegalArgumentException::class.java) { Disk().open().observe(null, report(0).put("flags", JSONArray(names)), "2026-11-06T00:00:00Z") }
    }
  }
  @Test fun summariesRetainGravityAndRejectBackwardAndNonfiniteEvents() {
    val stats = RestStatistics()
    stats.add(9007199254741001, floatArrayOf(1f, 0f, 9.8f)); stats.add(9007199274741001, floatArrayOf(3f, 0f, 9.8f))
    val result = stats.json()
    assertEquals(2.0, result.getJSONArray("mean").getDouble(0), 1e-9)
    assertEquals(9.8, result.getJSONArray("mean").getDouble(2), 1e-5)
    assertEquals(kotlin.math.sqrt(2.0), result.getJSONArray("std").getDouble(0), 1e-9)
    assertEquals(50.0, result.getDouble("rate_hz"), 1e-9)
    assertEquals(20.0, result.getDouble("max_gap_ms"), 1e-9); assertTrue(stats.usable)
    stats.add(9007199254741001, floatArrayOf(0f, 0f, 0f)); stats.add(9007199294741001, floatArrayOf(Float.NaN, 0f, 0f))
    assertFalse(stats.usable); assertEquals(2, stats.json().getInt("rejected_count"))
    stats.reset(); assertTrue(stats.json().isNull("mean")); assertTrue(stats.json().isNull("rms"))
  }
}
