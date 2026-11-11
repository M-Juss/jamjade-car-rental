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

internal class SetupCheck(
  private val manager: SensorManager,
  private val handler: Handler,
  private val utc: (Long) -> String,
  private val allowed: () -> Boolean,
) : SensorEventListener {
  private val window = StillnessWindow()
  private var document: JSONObject? = null
  private var consentElapsedNs = 0L
  private var consentWallMs = 0L
  var running = false
    private set
  var error: String? = null
    private set

  fun start(mountId: String, clockId: String) {
    cancel()
    consentWallMs = System.currentTimeMillis()
    consentElapsedNs = SystemClock.elapsedRealtimeNanos()
    window.start(consentElapsedNs)
    document = JSONObject().put("id", UUID.randomUUID().toString()).put("mount_version_id", mountId)
      .put("clock_context_id", clockId).put("consent_version", "rc-preflight-v1").put("consented_at", utc(consentWallMs))
      .put("summary_method_version", "rest-welford-v1").put("criteria_version", JSONObject.NULL)
      .put("holder_locked", true).put("phone_top_forward", true).put("rc_still", true)
    running = true
    for (type in listOf(Sensor.TYPE_ACCELEROMETER, Sensor.TYPE_GYROSCOPE)) {
      val sensor = manager.getDefaultSensor(type)
      if (sensor == null || !manager.registerListener(this, sensor, MOTION_INTERVAL_US, 0, handler)) {
        fail("Both motion sensors are needed for this check.")
        return
      }
    }
    handler.postDelayed(watchdog, WATCHDOG_MS)
  }

  private val watchdog = object : Runnable {
    override fun run() {
      if (!allowed()) { cancel(); return }
      val now = SystemClock.elapsedRealtimeNanos()
      if (window.sensorTimedOut(now)) {
        fail("Motion readings stopped. Try the setup check again.")
        return
      }
      window.expire(now)
      handler.postDelayed(this, WATCHDOG_MS)
    }
  }

  private fun finish() {
    val result = checkNotNull(document)
    val start = window.startNs
    val end = window.endNs
    result.put("started_at", utc(consentWallMs + (start - consentElapsedNs) / 1_000_000))
      .put("start_elapsed_ns", start.toString()).put("end_elapsed_ns", end.toString())
      .put("window_ms", (end - start) / 1e6)
      .put("measurements", JSONObject().put("accelerometer", window.acceleration.json()).put("gyroscope", window.rotation.json()))
      .put("checks", JSONObject().put("sensors", "passed").put("timing", "inconclusive")
        .put("orientation", "inconclusive").put("stability", "inconclusive"))
      .put("result", "inconclusive")
    stopListening()
  }

  fun progress(): JSONObject? = if (running) JSONObject()
    .put("steady_ms", window.steadyNs / 1_000_000).put("required_ms", StillnessWindow.REQUIRED_NS / 1_000_000)
    .put("phase", window.phase) else null

  fun result(): JSONObject? = document?.takeIf { !running && it.has("result") }

  private fun stopListening() {
    handler.removeCallbacks(watchdog)
    manager.unregisterListener(this)
    running = false
  }

  fun cancel() {
    stopListening()
    document = null
    error = null
  }

  private fun fail(message: String) {
    cancel()
    error = message
  }

  override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) = Unit

  override fun onSensorChanged(event: SensorEvent) {
    if (!running) return
    if (!allowed()) { cancel(); return }
    val now = SystemClock.elapsedRealtimeNanos()
    window.expire(now)
    if (now - event.timestamp > StillnessWindow.MAX_GAP_NS) return
    window.observe(event.sensor.type == Sensor.TYPE_GYROSCOPE, event.timestamp, event.values)
    if (window.steadyNs >= StillnessWindow.REQUIRED_NS) finish()
  }

  private companion object {
    const val WATCHDOG_MS = 100L
  }
}

/** Provisional motion limits for restarting the pilot window. */
internal class StillnessWindow {
  companion object {
    const val REQUIRED_NS = 5_000_000_000L
    const val MAX_GAP_NS = 250_000_000L
    private const val SENSOR_TIMEOUT_NS = 3_000_000_000L
    private const val ACCEL_DELTA_LIMIT = 0.5f // m/s² from the first reading in this window
    private const val ROTATION_LIMIT = 0.10f // rad/s
  }

  val acceleration = RestStatistics()
  val rotation = RestStatistics()
  private val baseline = FloatArray(3)
  private var consentNs = 0L
  private var lastAccel = 0L
  private var lastGyro = 0L
  private var moving = false

  val startNs: Long get() = minOf(acceleration.first, rotation.first)
  val endNs: Long get() = maxOf(acceleration.last, rotation.last)
  val steadyNs: Long get() = if (acceleration.usable && rotation.usable)
    (minOf(acceleration.last, rotation.last) - maxOf(acceleration.first, rotation.first)).coerceAtLeast(0) else 0
  val phase: String get() = when {
    steadyNs > 0 -> "steady"
    moving -> "moving"
    else -> "waiting"
  }

  fun start(timestamp: Long) {
    consentNs = timestamp
    lastAccel = timestamp
    lastGyro = timestamp
    reset()
  }

  fun sensorTimedOut(now: Long) = now - minOf(lastAccel, lastGyro) >= SENSOR_TIMEOUT_NS

  fun expire(now: Long) {
    if (now - minOf(lastAccel, lastGyro) > MAX_GAP_NS) reset()
  }

  fun observe(gyro: Boolean, timestamp: Long, values: FloatArray) {
    if (timestamp <= consentNs) return
    val last = if (gyro) lastGyro else lastAccel
    if (timestamp <= last || values.size < 3 || (0..2).any { !values[it].isFinite() }) {
      reset()
      return
    }
    expire(timestamp)
    if (gyro) lastGyro = timestamp else lastAccel = timestamp

    if (!gyro && acceleration.count == 0L) values.copyInto(baseline, endIndex = 3)
    val x = if (gyro) values[0] else values[0] - baseline[0]
    val y = if (gyro) values[1] else values[1] - baseline[1]
    val z = if (gyro) values[2] else values[2] - baseline[2]
    val limit = if (gyro) ROTATION_LIMIT else ACCEL_DELTA_LIMIT
    if (x * x + y * y + z * z > limit * limit) {
      reset()
      moving = true
      return
    }

    val stats = if (gyro) rotation else acceleration
    stats.add(timestamp, values)
    if (steadyNs > 0) moving = false
  }

  private fun reset() {
    acceleration.reset()
    rotation.reset()
    moving = false
  }
}

internal class RestStatistics {
  var count = 0L; private set
  var first = 0L; private set
  var last = 0L; private set
  private var gap = 0L; private var rejected = 0L
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
