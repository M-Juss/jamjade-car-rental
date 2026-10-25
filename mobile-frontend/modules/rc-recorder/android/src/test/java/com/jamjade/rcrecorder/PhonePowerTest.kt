package com.jamjade.rcrecorder

import android.os.BatteryManager
import org.junit.Assert.*
import org.junit.Test

class PhonePowerTest {
  @Test fun unavailableOrInvalidPowerValuesAreNotInvented() {
    for ((level, scale) in listOf(Pair(-1, -1), Pair(5, 0), Pair(101, 100))) {
      val value = PhonePower.batteryFacts(level, scale, BatteryManager.BATTERY_STATUS_UNKNOWN)
      assertTrue(value.isNull("battery_percent"))
      assertTrue(value.isNull("charging"))
    }
  }
  @Test fun percentageUsesTheReportedScaleAndChargingRemainsSeparateFromLowCharge() {
    val value = PhonePower.batteryFacts(10, 200, BatteryManager.BATTERY_STATUS_CHARGING)
    assertEquals(5.0, value.getDouble("battery_percent"), 0.0001)
    assertTrue(value.getBoolean("charging"))
    assertFalse(PhonePower.batteryFacts(80, 100, BatteryManager.BATTERY_STATUS_DISCHARGING).getBoolean("charging"))
  }
}
