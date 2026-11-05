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
    fun open() = CollectionWorkflow({ JSONObject(saved) }, { value ->
      if (fail) throw IOException("Synthetic failure")
      saved = value.toString()
    })
  }
  private fun group() = JSONObject("""{"id":"00000000-0000-4000-8000-000000000002","defaults":{"surface":"Tiles","slope":"level"}}""")
  @Test fun sessionNumbersSurviveReopeningAndRemountKeepsSessionIdentity() {
    val disk = Disk(); val first = disk.open().open(group(), "2026-11-06T00:00:00Z")
    val remount = disk.open().mount("remounted", "2026-11-06T00:01:00Z")
    assertEquals(first.getJSONObject("session").getString("id"), remount.getJSONObject("session").getString("id"))
    assertNotEquals(first.getJSONObject("mount").getString("id"), remount.getJSONObject("mount").getString("id"))
    assertEquals(2, remount.getJSONObject("mount").getInt("mount_number"))
    assertEquals("pending", remount.getJSONObject("mount").getString("alignment_status"))
    assertEquals(2, disk.open().open(group(), "2026-11-06T00:02:00Z").getJSONObject("session").getInt("session_number"))
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
