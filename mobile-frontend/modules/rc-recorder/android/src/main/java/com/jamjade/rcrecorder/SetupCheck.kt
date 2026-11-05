package com.jamjade.rcrecorder

import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.Handler
import android.os.SystemClock
import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID
import kotlin.math.sqrt

/** Five seconds is a bounded evidence window, not a validated stillness threshold. */
internal class SetupCheck(private val manager: SensorManager, private val handler: Handler, private val allowed: () -> Boolean) : SensorEventListener {
  private val channels = mapOf(1 to RestStatistics(), 4 to RestStatistics())
  private var document: JSONObject? = null
  private var started = 0L
  private var expires = 0L
  var running = false
    private set
  fun start(mountId: String, clockId: String, now: String, consentedAt: String) {
    cancel()
    channels.values.forEach { it.reset() }
    started = SystemClock.elapsedRealtimeNanos(); expires = started + 5000000000L
    document = JSONObject().put("id", UUID.randomUUID().toString()).put("mount_version_id", mountId)
      .put("clock_context_id", clockId).put("consent_version", "rc-preflight-v1").put("consented_at", consentedAt)
      .put("started_at", now).put("start_elapsed_ns", started.toString()).put("summary_method_version", "rest-welford-v1")
      .put("criteria_version", JSONObject.NULL).put("holder_locked", true).put("phone_top_forward", true).put("rc_still", true)
    running = true
    for (type in channels.keys) manager.getDefaultSensor(type)?.let { manager.registerListener(this, it, 20000, 0, handler) }
    handler.postDelayed(finish, 5000)
  }
  private val finish = Runnable {
    manager.unregisterListener(this); running = false
    val end = SystemClock.elapsedRealtimeNanos()
    val result = document ?: return@Runnable
    val acc = channels.getValue(1); val gyro = channels.getValue(4)
    val timing = allowed() && end - started <= 30000000000L && acc.usable && gyro.usable
    result.put("end_elapsed_ns", end.toString()).put("window_ms", (end - started) / 1000000.0)
      .put("measurements", JSONObject().put("accelerometer", acc.json()).put("gyroscope", gyro.json()))
      .put("checks", JSONObject().put("sensors", if (acc.count > 0 && gyro.count > 0) "passed" else "failed")
        .put("timing", if (timing) "inconclusive" else "failed").put("orientation", "inconclusive").put("stability", "inconclusive"))
      .put("result", if (timing) "inconclusive" else "failed")
  }
  fun result(): JSONObject? = document?.takeIf { !running && it.has("result") }
  fun cancel() { handler.removeCallbacks(finish); manager.unregisterListener(this); running = false; document = null }
  override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) = Unit
  override fun onSensorChanged(event: SensorEvent) {
    if (!allowed()) { cancel(); return }
    if (!running || event.timestamp < started || event.timestamp > expires || event.values.size < 3) return
    channels[event.sensor.type]?.add(event.timestamp, event.values)
  }
}

internal class RestStatistics {
  var count = 0L; private set
  private var first = 0L; private var last = 0L; private var gap = 0L; private var rejected = 0L
  private val mean = DoubleArray(3); private val m2 = DoubleArray(3); private var squareNorm = 0.0
  val usable: Boolean get() = count >= 2 && rejected == 0L && last > first
  fun reset() { count = 0; first = 0; last = 0; gap = 0; rejected = 0; mean.fill(0.0); m2.fill(0.0); squareNorm = 0.0 }
  fun add(timestamp: Long, values: FloatArray) {
    if (values.size < 3 || (0..2).any { !values[it].isFinite() } || (count > 0 && timestamp <= last)) { rejected++; return }
    if (count == 0L) first = timestamp else gap = maxOf(gap, timestamp - last)
    last = timestamp; count++
    for (i in 0..2) { val value = values[i].toDouble(); val delta = value - mean[i]; mean[i] += delta / count; m2[i] += delta * (value - mean[i]); squareNorm += value * value }
  }
  fun json() = JSONObject().put("count", count).put("rejected_count", rejected)
    .put("mean", if (count > 0) JSONArray(mean.toList()) else JSONObject.NULL)
    .put("std", if (count > 1) JSONArray(m2.map { sqrt(it.coerceAtLeast(0.0) / (count - 1)) }) else JSONObject.NULL)
    .put("rms", if (count > 0) sqrt(squareNorm / count) else JSONObject.NULL)
    .put("rate_hz", if (count > 1 && last > first) (count - 1) * 1e9 / (last - first) else JSONObject.NULL)
    .put("max_gap_ms", if (count > 1) gap / 1e6 else JSONObject.NULL)
}
