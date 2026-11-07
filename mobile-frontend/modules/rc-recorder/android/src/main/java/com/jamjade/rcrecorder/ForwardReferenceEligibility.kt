package com.jamjade.rcrecorder

import org.json.JSONObject

internal object ForwardReferenceEligibility {
  fun matches(record: JSONObject, sessionId: String, mountId: String): Boolean {
    val binding = record.optJSONObject("collection_binding") ?: return false
    return record.optJSONObject("context")?.optString("recording_kind") == "forward_reference" &&
      record.optString("state") == "stopped" && record.optString("integrity") == "sealed" &&
      record.optDouble("duration_ms", 0.0) > 0 && (record.optJSONArray("chunks")?.length() ?: 0) > 0 &&
      binding.optString("research_session_id") == sessionId && binding.optString("mount_version_id") == mountId
  }
}
