package com.jamjade.rcrecorder

/** Bounded timing diagnostics. Quantiles are explicitly approximate one-millisecond bins. */
internal class ChannelStatistics {
  var received = 0L
  var valid = 0L
  var persisted = 0L
  var rejected = 0L
  var duplicates = 0L
  var backwards = 0L
  var accuracyChanges = 0L
  var futureTimestamps = 0L
  var preStart = 0L
  var firstNs: Long? = null
  var lastNs: Long? = null
  var maxGapNs = 0L
  var maxReceiptDelayNs = 0L
  private var accuracy: Int? = null
  private val intervals = LongArray(1002)
  private var positiveIntervals = 0L

  fun observe(timestamp: Long, receipt: Long, values: FloatArray, code: Int, start: Long): Boolean {
    received++
    if (timestamp < 0 || values.any { !it.isFinite() }) { rejected++; return false }
    if (accuracy != null && accuracy != code) accuracyChanges++
    accuracy = code
    if (timestamp > receipt) futureTimestamps++
    if (timestamp < start) preStart++
    maxReceiptDelayNs = maxOf(maxReceiptDelayNs, receipt - timestamp)
    val previous = lastNs
    if (previous != null) {
      val delta = timestamp - previous
      when {
        delta == 0L -> duplicates++
        delta < 0L -> backwards++
        else -> {
          maxGapNs = maxOf(maxGapNs, delta)
          val bucket = minOf(1001L, delta / 1000000 + if (delta % 1000000 > 0) 1 else 0).toInt()
          intervals[bucket]++
          positiveIntervals++
        }
      }
    }
    if (firstNs == null) firstNs = timestamp
    lastNs = timestamp
    valid++
    return true
  }

  fun rateHz(): Double? {
    val span = (lastNs ?: return null) - (firstNs ?: return null)
    return if (valid > 1 && span > 0 && backwards == 0L) (valid - 1) * 1e9 / span else null
  }

  fun intervalQuantileMs(fraction: Double): Int? {
    if (positiveIntervals == 0L) return null
    val target = kotlin.math.ceil(positiveIntervals * fraction).toLong().coerceAtLeast(1)
    var count = 0L
    for (index in intervals.indices) {
      count += intervals[index]
      if (count >= target) return if (index == 1001) null else index
    }
    return null
  }
}
