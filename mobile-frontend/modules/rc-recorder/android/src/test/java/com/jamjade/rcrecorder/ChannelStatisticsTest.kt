package com.jamjade.rcrecorder

import org.junit.Assert.*
import org.junit.Test

class ChannelStatisticsTest {
  @Test fun measuresSensorTimeRatherThanReceiptTime() {
    val stats = ChannelStatistics()
    stats.observe(1000000000, 1100000000, floatArrayOf(1f, 2f, 3f), 3, 1000000000)
    stats.observe(1020000000, 1500000000, floatArrayOf(1f, 2f, 3f), 3, 1000000000)
    assertEquals(50.0, stats.rateHz()!!, 0.001)
    assertEquals(20000000L, stats.maxGapNs)
    assertEquals(20, stats.intervalQuantileMs(0.95))
  }

  @Test fun accountsForNonfiniteReadingsWithoutReplacingThem() {
    val stats = ChannelStatistics()
    assertFalse(stats.observe(1, 2, floatArrayOf(Float.NaN, 0f, 0f), 0, 0))
    assertEquals(1L, stats.received)
    assertEquals(1L, stats.rejected)
    assertEquals(0L, stats.valid)
    assertNull(stats.firstNs)
    assertNull(stats.rateHz())
  }

  @Test fun flagsClockAnomaliesAndRetainsValidSourceReadings() {
    val stats = ChannelStatistics()
    stats.observe(100, 200, floatArrayOf(0f, 0f, 0f), 3, 100)
    stats.observe(100, 200, floatArrayOf(0f, 0f, 0f), 3, 100)
    stats.observe(90, 200, floatArrayOf(0f, 0f, 0f), 2, 100)
    assertEquals(3L, stats.valid)
    assertEquals(1L, stats.duplicates)
    assertEquals(1L, stats.backwards)
    assertEquals(1L, stats.accuracyChanges)
    assertEquals(1L, stats.preStart)
    assertNull(stats.rateHz())
  }

  @Test fun longGapsDoNotOverflowTheBoundedIntervalHistogram() {
    val stats = ChannelStatistics()
    stats.observe(1, 2, floatArrayOf(0f, 0f, 0f), 3, 0)
    stats.observe(3000000000000000L, 3000000000000001L, floatArrayOf(0f, 0f, 0f), 3, 0)
    assertEquals(2999999999999999L, stats.maxGapNs)
    assertNull(stats.intervalQuantileMs(0.95))
  }
}
