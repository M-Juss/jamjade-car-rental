package com.jamjade.rcrecorder

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class StillnessWindowTest {
  private val window = StillnessWindow()
  private val resting = floatArrayOf(0f, 0f, 9.81f)
  private val quiet = floatArrayOf(0f, 0f, 0f)

  @Test fun rotationAtThreeSecondsRequiresFiveFreshSeconds() {
    window.start(ns(1))
    still(20, 3020)
    assertEquals(ns(3000), window.steadyNs)

    window.observe(gyro = true, ns(3040), floatArrayOf(0f, 0f, 0.3f))
    assertEquals("moving", window.phase)
    assertEquals(0L, window.steadyNs)
    assertEquals(0L, window.rotation.count)

    still(3060, 8040)
    assertEquals(ns(4980), window.steadyNs)
    still(8060, 8060)
    assertEquals(StillnessWindow.REQUIRED_NS, window.steadyNs)
    assertEquals(ns(3060), window.startNs)
    assertEquals(ns(8060), window.endNs)
    assertEquals(251L, window.acceleration.count)
    assertEquals(251L, window.rotation.count)
  }

  @Test fun accelerationChangeClearsBothChannels() {
    window.start(ns(1))
    still(20, 3020)
    window.observe(gyro = false, ns(3040), floatArrayOf(0.6f, 0f, 9.81f))
    assertEquals(0L, window.steadyNs)
    assertEquals(0L, window.acceleration.count)
    assertEquals(0L, window.rotation.count)
  }

  @Test fun missingReadingsCannotAdvanceTheWindow() {
    window.start(ns(1))
    still(20, 3020)
    for (ms in 3040..3320 step 20) window.observe(gyro = false, ns(ms), resting)
    assertEquals(0L, window.steadyNs)
    assertEquals("waiting", window.phase)
    assertFalse(window.sensorTimedOut(ns(6019)))
    assertTrue(window.sensorTimedOut(ns(6020)))
    still(6040, 11040)
    assertEquals(ns(4980), window.steadyNs)
    still(11060, 11060)
    assertEquals(StillnessWindow.REQUIRED_NS, window.steadyNs)
  }

  private fun still(fromMs: Int, toMs: Int) {
    for (ms in fromMs..toMs step 20) {
      window.observe(gyro = false, ns(ms), resting)
      window.observe(gyro = true, ns(ms), quiet)
    }
  }

  private fun ns(ms: Int) = ms * 1_000_000L
}
