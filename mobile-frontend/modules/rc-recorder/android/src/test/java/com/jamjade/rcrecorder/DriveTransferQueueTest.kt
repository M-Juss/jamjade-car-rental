package com.jamjade.rcrecorder

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

class DriveTransferQueueTest {
  private fun queue() = JSONObject().put("batches", JSONArray())
  private fun batch(session: String, id: String) = JSONObject().put("session_id", session)
    .put("payload", JSONObject().put("client_batch_id", id))

  @Test fun closeIntentSurvivesSerializationWithoutCredentials() {
    val queue = queue()
    DriveTransferQueue.bind(queue, "session", "recording")
    DriveTransferQueue.requestClose(queue, "session")
    val restored = JSONObject(queue.toString())
    assertTrue(DriveTransferQueue.closing(restored, "session"))
    assertFalse(restored.toString().contains("token"))
    assertFalse(DriveTransferQueue.closing(restored, "other"))
  }

  @Test fun repeatedBindingCannotEraseCloseIntent() {
    val queue = queue()
    DriveTransferQueue.bind(queue, "session", "recording")
    DriveTransferQueue.requestClose(queue, "session")
    DriveTransferQueue.bind(queue, "session", "recording")
    assertTrue(DriveTransferQueue.closing(queue, "session"))
  }

  @Test(expected = IllegalArgumentException::class) fun cannotBindDifferentRecording() {
    val queue = queue()
    DriveTransferQueue.bind(queue, "session", "recording")
    DriveTransferQueue.bind(queue, "session", "different")
  }

  @Test fun acknowledgementRetainsOtherBatchesAndIsIdempotent() {
    val queue = queue()
    queue.getJSONArray("batches").put(batch("one", "a")).put(batch("one", "b")).put(batch("two", "a"))
    DriveTransferQueue.acknowledge(queue, "one", "a")
    DriveTransferQueue.acknowledge(queue, "one", "a")
    assertEquals(1, DriveTransferQueue.pending(queue, "one"))
    assertEquals(1, DriveTransferQueue.pending(queue, "two"))
  }

  @Test(expected = IllegalStateException::class) fun cannotCompleteWithPendingData() {
    val queue = queue()
    DriveTransferQueue.bind(queue, "session", "recording")
    queue.getJSONArray("batches").put(batch("session", "a"))
    DriveTransferQueue.complete(queue, "session")
  }

  @Test fun completeRemovesOnlyAcknowledgedSessionIntent() {
    val queue = queue()
    DriveTransferQueue.bind(queue, "one", "recording")
    DriveTransferQueue.bind(queue, "two", "recording2")
    DriveTransferQueue.requestClose(queue, "one")
    DriveTransferQueue.requestClose(queue, "two")
    DriveTransferQueue.complete(queue, "one")
    assertFalse(DriveTransferQueue.closing(queue, "one"))
    assertTrue(DriveTransferQueue.closing(queue, "two"))
  }
}
