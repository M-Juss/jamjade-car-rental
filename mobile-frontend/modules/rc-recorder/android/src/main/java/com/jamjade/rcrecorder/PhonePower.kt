package com.jamjade.rcrecorder

import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.BatteryManager
import android.os.PowerManager
import android.os.SystemClock
import org.json.JSONObject

internal object PhonePower {
  fun batteryFacts(level: Int, scale: Int, charge: Int): JSONObject {
    val result = JSONObject().put("battery_percent", JSONObject.NULL).put("charging", JSONObject.NULL)
    if (level >= 0 && scale > 0 && level <= scale) result.put("battery_percent", level * 100.0 / scale)
    when (charge) {
      BatteryManager.BATTERY_STATUS_CHARGING, BatteryManager.BATTERY_STATUS_FULL -> result.put("charging", true)
      BatteryManager.BATTERY_STATUS_DISCHARGING, BatteryManager.BATTERY_STATUS_NOT_CHARGING -> result.put("charging", false)
    }
    return result
  }

  fun snapshot(context: Context): JSONObject {
    val result = JSONObject().put("elapsed_ns", SystemClock.elapsedRealtimeNanos().toString())
      .put("battery_percent", JSONObject.NULL).put("charging", JSONObject.NULL).put("battery_saver", JSONObject.NULL)
    try {
      val status = context.registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
      val level = status?.getIntExtra(BatteryManager.EXTRA_LEVEL, -1) ?: -1
      val scale = status?.getIntExtra(BatteryManager.EXTRA_SCALE, -1) ?: -1
      val charge = status?.getIntExtra(BatteryManager.EXTRA_STATUS, -1) ?: -1
      val facts = batteryFacts(level, scale, charge)
      result.put("battery_percent", facts.get("battery_percent")).put("charging", facts.get("charging"))
      result.put("battery_saver", context.getSystemService(PowerManager::class.java).isPowerSaveMode)
    } catch (_: Exception) { result.put("read_error", "unavailable") }
    return result
  }

  fun update(record: JSONObject, context: Context, ended: Boolean = false) {
    val power = record.getJSONObject("phone_power")
    val next = snapshot(context)
    val previous = power.getJSONObject("latest")
    if (listOf("battery_percent", "charging", "battery_saver").any { previous.opt(it) != next.opt(it) }) {
      val changes = power.getJSONArray("changes")
      if (changes.length() < 256) changes.put(next) else power.put("omitted_changes", power.getInt("omitted_changes") + 1)
    }
    power.put("latest", next)
    if (ended) power.put("end", next)
  }
}
