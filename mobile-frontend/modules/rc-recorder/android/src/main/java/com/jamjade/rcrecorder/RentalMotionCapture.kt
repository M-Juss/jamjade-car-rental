package com.jamjade.rcrecorder

import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.Handler
import android.os.SystemClock
import org.json.JSONArray
import org.json.JSONObject
import java.util.ArrayDeque
import java.util.UUID

internal const val MOTION_INTERVAL_US = 20_000

/** Foreground rental setup samples with a bounded unread buffer. */
internal class RentalMotionCapture(
  private val manager: SensorManager,
  private val handler: Handler,
) : SensorEventListener {
  private data class Point(val ns: Long, val values: FloatArray)

  private val channels = linkedMapOf(
    Sensor.TYPE_ACCELEROMETER to ArrayDeque<Point>(),
    Sensor.TYPE_GYROSCOPE to ArrayDeque<Point>(),
    Sensor.TYPE_GRAVITY to ArrayDeque<Point>(),
  )
  private val intervalNs = MOTION_INTERVAL_US * 1000L
  private var rows = JSONArray()
  private var startedNs = 0L
  private var startedWallMs = 0L
  private var gridNs = 0L
  private var id: String? = null
  val running: Boolean get() = id != null
  private val expire = Runnable { cancel() }
  private var expiresOnReadInactivity = false

  fun start(seconds: Int): String {
    check(!running) { "Another motion check is active." }
    require(seconds == 0 || seconds in 3..30)
    expiresOnReadInactivity = seconds == 0
    startedNs = SystemClock.elapsedRealtimeNanos()
    startedWallMs = System.currentTimeMillis()
    gridNs = startedNs
    val captureId = UUID.randomUUID().toString()
    id = captureId
    try {
      for (type in channels.keys) {
        val sensor = manager.getDefaultSensor(type) ?: error("A motion sensor needed for calibration is unavailable.")
        check(manager.registerListener(this, sensor, MOTION_INTERVAL_US, 0, handler)) {
          "Motion access is unavailable. Check device settings and try again."
        }
      }
      handler.postDelayed(expire, seconds * 1000L + 4000L)
      return captureId
    } catch (failure: Exception) {
      cancel()
      throw failure
    }
  }

  fun read(captureId: String): JSONObject {
    check(id == captureId) { "Calibration stopped. Keep the app open and retry while parked." }
    if (expiresOnReadInactivity) {
      handler.removeCallbacks(expire)
      handler.postDelayed(expire, 4000L)
    }
    val batch = rows
    rows = JSONArray()
    return JSONObject()
      .put("wallMs", startedWallMs)
      .put("clockMs", (SystemClock.elapsedRealtimeNanos() - startedNs) / 1e6)
      .put("rows", batch)
  }

  fun cancel(captureId: String? = null) {
    if (!running || captureId != null && captureId != id) return
    id = null
    handler.removeCallbacks(expire)
    manager.unregisterListener(this)
    channels.values.forEach { it.clear() }
    rows = JSONArray()
  }

  override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) = Unit

  override fun onSensorChanged(event: SensorEvent) {
    if (!running || event.timestamp < startedNs || event.values.size < 3) return
    if (SystemClock.elapsedRealtimeNanos() - event.timestamp > 250_000_000L) return
    val queue = channels[event.sensor.type] ?: return
    if (queue.peekLast()?.let { it.ns >= event.timestamp } == true) return
    if (!(0..2).all { event.values[it].isFinite() }) return
    queue.addLast(Point(event.timestamp, event.values.copyOf(3)))
    while (queue.size > 1 && queue.first.ns < event.timestamp - 250_000_000L) queue.removeFirst()
    if (channels.values.any { it.isEmpty() }) return
    val earliest = channels.values.maxOf { it.first.ns }
    if (earliest > gridNs) gridNs += ((earliest - gridNs + intervalNs - 1) / intervalNs) * intervalNs
    val latest = channels.values.minOf { it.last.ns }
    while (gridNs <= latest) {
      val row = JSONArray().put((gridNs - startedNs) / 1e6)
      val valid = channels.all { (type, points) ->
        while (points.size > 1 && points.elementAt(1).ns <= gridNs) points.removeFirst()
        val before = points.first
        val after = points.elementAtOrNull(1)
        if (before.ns == gridNs) {
          before.values.forEach { row.put(it.toDouble()) }
          true
        } else {
          val maxBracketNs = if (type == Sensor.TYPE_GRAVITY) 100_000_000L else 60_000_000L
          if (after == null || after.ns - before.ns > maxBracketNs) false
          else {
            val fraction = (gridNs - before.ns).toDouble() / (after.ns - before.ns)
            for (axis in 0..2) row.put(before.values[axis] + fraction * (after.values[axis] - before.values[axis]))
            true
          }
        }
      }
      if (valid) {
        if (rows.length() >= 200) { cancel(); return }
        rows.put(row)
      }
      gridNs += intervalNs
    }
  }
}
