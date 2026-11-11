package com.jamjade.rcrecorder

import org.json.JSONArray
import org.json.JSONObject

/** Durable transfer intent contains no credentials and never authorizes sensor restart. */
internal object DriveTransferQueue {
  fun bind(queue: JSONObject, session: String, recording: String) {
    val bindings = queue.optJSONObject("sessions") ?: JSONObject().also { queue.put("sessions", it) }
    val previous = bindings.optJSONObject(session)
    require(previous == null || previous.getString("recording_id") == recording) { "Monitoring recording changed." }
    if (previous == null) bindings.put(session, JSONObject().put("recording_id", recording).put("closing", false))
  }

  fun closing(queue: JSONObject, session: String): Boolean =
    queue.optJSONObject("sessions")?.optJSONObject(session)?.optBoolean("closing") == true

  fun requestClose(queue: JSONObject, session: String) {
    val binding = queue.optJSONObject("sessions")?.optJSONObject(session)
      ?: error("Monitoring transfer is not connected.")
    binding.put("closing", true)
  }

  fun complete(queue: JSONObject, session: String) {
    check(pending(queue, session) == 0) { "Monitoring still has pending batches." }
    queue.optJSONObject("sessions")?.remove(session)
  }

  fun pending(queue: JSONObject, session: String): Int {
    val batches = queue.getJSONArray("batches")
    return (0 until batches.length()).count { batches.getJSONObject(it).getString("session_id") == session }
  }

  fun acknowledge(queue: JSONObject, session: String, batchId: String) {
    val batches = queue.getJSONArray("batches")
    val remaining = JSONArray()
    for (index in 0 until batches.length()) {
      val batch = batches.getJSONObject(index)
      if (batch.getString("session_id") != session || batch.getJSONObject("payload").getString("client_batch_id") != batchId) remaining.put(batch)
    }
    queue.put("batches", remaining)
  }
}
