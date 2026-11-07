package com.jamjade.rcrecorder

import org.junit.Assert.*
import org.junit.Test

class RecordingPaginationTest {
  @Test fun emptyAndTenItemLibrariesCannotOpenAnEmptySecondPage() {
    assertEquals(0, RecordingPagination.offset(0, 10))
    assertEquals(0, RecordingPagination.offset(10, 10))
    assertEquals(10, RecordingPagination.LIMIT)
  }
  @Test fun elevenItemsHaveTwoPagesAndDeletionClampsToTheLastPage() {
    assertEquals(10, RecordingPagination.offset(11, 10))
    assertEquals(10, RecordingPagination.offset(20, 20))
    assertEquals(20, RecordingPagination.offset(21, 20))
    assertEquals(90, RecordingPagination.offset(100, 100))
  }
}
