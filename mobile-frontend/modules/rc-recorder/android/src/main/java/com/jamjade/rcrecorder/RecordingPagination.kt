package com.jamjade.rcrecorder

internal object RecordingPagination {
  const val LIMIT = 10
  fun offset(total: Int, requested: Int): Int {
    require(total >= 0 && requested >= 0)
    return if (total == 0) 0 else minOf(requested, ((total - 1) / LIMIT) * LIMIT)
  }
}
