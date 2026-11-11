package com.jamjade.rcrecorder

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

class DriveMotionPipelineTest {
  @Test fun matchesIndependentPhpSynchronizationFilteringRotationAndAll35Features() {
    val fixture = javaClass.classLoader!!.getResourceAsStream("drive-pipeline-parity.json")!!.bufferedReader().use { it.readText() }
    val cases = JSONArray(fixture)
    for (case in 0 until cases.length()) {
      val source = cases.getJSONObject(case)
      val actual = mutableListOf<JSONObject>()
      val pipeline = DriveMotionPipeline(source.getJSONObject("reference"), 1000000000L) { actual.add(it) }
      val readings = mutableListOf<Triple<Long, Int, DoubleArray>>()
      for ((channel, name) in listOf("a", "g").withIndex()) {
        val rows = source.getJSONArray(name)
        for (i in 0 until rows.length()) {
          val row = rows.getJSONObject(i); val v = row.getJSONArray("values")
          readings.add(Triple(row.getString("sensor_timestamp_ns").toLong(), channel, DoubleArray(3) { v.getDouble(it) }))
        }
      }
      readings.sortedBy { it.first }.forEach { (ns, channel, values) -> pipeline.accept(channel, ns, values) }
      val expected = source.getJSONArray("windows")
      assertEquals("case $case window count", expected.length(), actual.size)
      for (index in actual.indices) {
        val window = expected.getJSONObject(index)
        assertEquals(window.getString("id"), actual[index].getString("id"))
        for (feature in 0..34) assertEquals("case $case window $index feature $feature",
          window.getJSONArray("features").getDouble(feature), actual[index].getJSONArray("features").getDouble(feature), 1e-9)
      }
      assertTrue(pipeline.paired > 0)
    }
  }

  @Test fun temporalFeaturesAreInvariantToMirroringAndMergeSameDirectionPhases() {
    val yaw = List(6) {2.0} + List(3) {0.0} + List(6) {2.0} + List(5) {0.0} + List(7) {-1.0}
    val rows = yaw.mapIndexed { index, value -> doubleArrayOf(index*20.0, 0.0,0.0,0.0,0.0,0.0,value) }
    val values = DriveMotionPipeline.features(rows)
    assertEquals(2.0, values[30], 0.0)
    assertArrayEquals(doubleArrayOf(.14, 7.0/24, .14, .10), values.sliceArray(31..34), 1e-12)
    val mirror = rows.map { it.copyOf().apply { this[6] = -this[6] } }
    assertArrayEquals(values.sliceArray(30..34), DriveMotionPipeline.features(mirror).sliceArray(30..34), 1e-12)
  }

  @Test(expected = IllegalArgumentException::class) fun rejectsMissingGridRows() {
    DriveMotionPipeline.features(listOf(doubleArrayOf(0.0,0.0,0.0,0.0,0.0,0.0,0.0), doubleArrayOf(40.0,0.0,0.0,0.0,0.0,0.0,0.0)))
  }
}
