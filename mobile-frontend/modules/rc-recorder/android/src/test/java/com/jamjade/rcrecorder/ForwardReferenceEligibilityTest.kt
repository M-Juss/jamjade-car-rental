package com.jamjade.rcrecorder

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

class ForwardReferenceEligibilityTest {
  private fun reference() = JSONObject().put("context", JSONObject().put("recording_kind", "forward_reference"))
    .put("state", "stopped").put("integrity", "sealed").put("duration_ms", 18000)
    .put("chunks", JSONArray().put(JSONObject()))
    .put("collection_binding", JSONObject().put("research_session_id", "session").put("mount_version_id", "mount"))
  @Test fun onlyASealedForwardReferenceFromThisSessionAndMountSatisfiesCaptureOrder() {
    assertTrue(ForwardReferenceEligibility.matches(reference(), "session", "mount"))
    assertFalse(ForwardReferenceEligibility.matches(reference(), "other-session", "mount"))
    assertFalse(ForwardReferenceEligibility.matches(reference(), "session", "other-mount"))
    for (state in listOf("recording", "interrupted", "preparing")) {
      assertFalse(ForwardReferenceEligibility.matches(reference().put("state", state), "session", "mount"))
    }
    assertFalse(ForwardReferenceEligibility.matches(reference().put("integrity", "unverified_tail"), "session", "mount"))
    assertFalse(ForwardReferenceEligibility.matches(reference().put("duration_ms", 0), "session", "mount"))
    assertFalse(ForwardReferenceEligibility.matches(reference().put("chunks", JSONArray()), "session", "mount"))
    assertFalse(ForwardReferenceEligibility.matches(reference().put("context", JSONObject().put("recording_kind", "maneuver_trial")), "session", "mount"))
    val legacy = reference().apply { remove("collection_binding") }
    assertFalse(ForwardReferenceEligibility.matches(legacy, "session", "mount"))
  }
}
