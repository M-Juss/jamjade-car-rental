package com.jamjade.rcrecorder

import org.json.JSONArray
import org.json.JSONObject
import kotlin.math.*

/** Native counterpart of RcMotionProcessing + DriveMonitoringFeatureService; no UI clock. */
internal class DriveMotionPipeline(reference: JSONObject, private val origin: Long, private val emit: (JSONObject) -> Unit) {
  private data class Reading(val ns: Long, val values: DoubleArray)
  private val channels = Array(2) { ArrayDeque<Reading>() }
  private val filters = Array(2) { Filter() }
  private val matrix = Array(3) { vector(reference.getJSONArray("rotation_rfu").getJSONArray(it)) }
  private val offsets = arrayOf(vector(reference.getJSONArray("acceleration_mean")), vector(reference.getJSONArray("gyroscope_mean")))
  private var grid = 0L
  private val rows = ArrayDeque<DoubleArray>()
  var paired = 0L; private set
  var gaps = 0L; private set
  init {
    require(reference.getJSONArray("rotation_rfu").length() == 3)
    for (i in 0..2) for (j in 0..2) require(abs(matrix[i].indices.sumOf { matrix[i][it] * matrix[j][it] } - if (i == j) 1.0 else 0.0) < 1e-6)
    val determinant = matrix[0][0] * (matrix[1][1]*matrix[2][2]-matrix[1][2]*matrix[2][1]) -
      matrix[0][1] * (matrix[1][0]*matrix[2][2]-matrix[1][2]*matrix[2][0]) +
      matrix[0][2] * (matrix[1][0]*matrix[2][1]-matrix[1][1]*matrix[2][0])
    require(abs(determinant - 1) < 1e-6)
  }

  fun accept(channel: Int, ns: Long, values: DoubleArray) {
    require(channel in 0..1 && values.size == 3 && values.all { it.isFinite() })
    if (ns < origin || channels[channel].lastOrNull()?.ns?.let { ns <= it } == true) return
    channels[channel].addLast(Reading(ns, values.copyOf()))
    // Bound memory if one sensor stalls. The recorder also stops on sensor-stall diagnostics.
    while (channels[channel].size > 512) channels[channel].removeFirst()
    if (channels.any { it.isEmpty() }) return
    val last = min(channels[0].last().ns, channels[1].last().ns)
    while (origin + grid <= last) {
      val time = grid / 1e6
      val processed = Array(2) { axis ->
        val queue = channels[axis]
        val target = origin + grid
        while (queue.size > 1 && queue.elementAt(1).ns <= target) queue.removeFirst()
        val first = queue.first()
        val next = queue.elementAtOrNull(1)
        val sample = when {
          first.ns == target -> first.values
          first.ns < target && next != null && next.ns - first.ns <= 60000000L -> {
            val fraction = (target - first.ns).toDouble() / (next.ns - first.ns)
            DoubleArray(3) { (1 - fraction) * first.values[it] + fraction * next.values[it] }
          }
          else -> null
        }
        filters[axis].apply(sample, time)?.let { filtered ->
          val centered = DoubleArray(3) { filtered[it] - offsets[axis][it] }
          val rfu = DoubleArray(3) { row -> (0..2).sumOf { matrix[row][it] * centered[it] } }
          doubleArrayOf(rfu[1], rfu[0], rfu[2])
        }
      }
      if (processed.any { it == null }) {
        rows.clear(); gaps++
      } else {
        paired++
        rows.addLast(doubleArrayOf(time, *processed[0]!!, *processed[1]!!))
        while (rows.size > 280) rows.removeFirst()
        if ((grid / 20000000L + 1) % 10 == 0L) {
          for (size in intArrayOf(20, 40, 80, 160, 280)) if (rows.size >= size) {
            val slice = rows.toList().takeLast(size)
            val start = slice.first()[0].toLong()
            val end = time.toLong() + 20
            val peakIndex = slice.indices.minBy { slice[it][1] }
            val nearby = slice.subList(max(0, peakIndex - 7), min(size, peakIndex + 8))
            emit(JSONObject().put("id", "w-$start-$end").put("start_ms", start).put("end_ms", end)
              .put("features", JSONArray(features(slice).toList()))
              .put("braking_evidence", JSONObject().put("peak_ms", slice[peakIndex][0].toLong())
                .put("vertical_peak", nearby.maxOf { abs(it[3]) }).put("pitch_rate_peak", nearby.maxOf { abs(it[5]) })))
          }
        }
      }
      grid += 20000000L
    }
  }

  private class Filter {
    private val k = tan(Math.PI * 5 / 50)
    private val norm = 1 / (1 + sqrt(2.0) * k + k*k)
    private val b = doubleArrayOf(k*k*norm, 2*k*k*norm, k*k*norm)
    private val a = doubleArrayOf(1.0, 2*(k*k-1)*norm, (1-sqrt(2.0)*k+k*k)*norm)
    private var x1: DoubleArray? = null
    private var x2 = doubleArrayOf(); private var y1 = doubleArrayOf(); private var y2 = doubleArrayOf()
    private var start = 0.0
    fun apply(v: DoubleArray?, time: Double): DoubleArray? {
      if (v == null) { x1 = null; return null }
      if (x1 == null) { x1 = v; x2 = v; y1 = v; y2 = v; start = time }
      val result = DoubleArray(3) { b[0]*v[it]+b[1]*x1!![it]+b[2]*x2[it]-a[1]*y1[it]-a[2]*y2[it] }
      x2 = x1!!; x1 = v; y2 = y1; y1 = result
      return if (time - start < 500) null else result
    }
  }

  companion object {
    private fun vector(values: JSONArray): DoubleArray {
      require(values.length() == 3)
      return DoubleArray(3) { require(values.get(it) is Number); values.getDouble(it).also { n -> require(n.isFinite()) } }
    }
    fun features(rows: List<DoubleArray>): DoubleArray {
      require(rows.isNotEmpty() && rows.size <= 280)
      rows.forEachIndexed { index, row ->
        require(row.size == 7 && row.all { it.isFinite() } && (index == 0 || row[0] - rows[index-1][0] == 20.0))
      }
      val result = mutableListOf<Double>()
      for (axis in 1..6) {
        var mean = 0.0; var m2 = 0.0; var squares = 0.0
        var low = Double.POSITIVE_INFINITY; var high = Double.NEGATIVE_INFINITY
        rows.forEachIndexed { index, row ->
          val value = row[axis]; val delta = value - mean
          mean += delta / (index + 1); m2 += delta * (value - mean); squares += value*value
          low = min(low, value); high = max(high, value)
        }
        result.addAll(listOf(mean, sqrt(max(0.0, m2 / rows.size)), low, high, sqrt(squares / rows.size)))
      }
      data class Phase(val direction: Int, val start: Int, var end: Int, var area: Double)
      val phases = mutableListOf<Phase>()
      val peak = rows.maxOf { abs(it[6]) }
      if (peak > 0) {
        val threshold = .25 * peak
        fun direction(value: Double) = if (value >= threshold) 1 else if (value <= -threshold) -1 else 0
        var start = 0; var sign = direction(rows[0][6])
        for (index in 1..rows.size) {
          val next = if (index < rows.size) direction(rows[index][6]) else 2
          if (next == sign) continue
          if (sign != 0 && index-start >= 6) {
            val area = (start until index).sumOf { abs(rows[it][6]) } * .02
            val last = phases.lastOrNull()
            if (last?.direction == sign) { last.end = index; last.area += area }
            else phases.add(Phase(sign, start, index, area))
          }
          start = index; sign = next
        }
      }
      result.add(phases.size.toDouble())
      if (phases.size >= 2) {
        val first = phases[0]; val second = phases[1]; val smaller = min(first.area, second.area)
        result.addAll(listOf(smaller, smaller / max(first.area, second.area),
          min(first.end-first.start, second.end-second.start)*.02, (second.start-first.end)*.02))
      } else result.addAll(listOf(0.0,0.0,0.0,0.0))
      require(result.all { it.isFinite() })
      return result.toDoubleArray()
    }
  }
}
