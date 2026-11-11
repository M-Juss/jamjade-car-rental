package com.jamjade.rcrecorder

import android.os.Handler
import com.facebook.react.modules.network.OkHttpClientProvider
import okhttp3.Call
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

/** Credentials stay in memory; encrypted queue access is serialized on the recorder actor. */
internal class DriveBatchUploader(
  private val handler: Handler,
  private val next: (String) -> JSONObject?,
  private val acknowledge: (String, String) -> Unit,
  private val complete: (String) -> Unit,
) {
  private val executor = Executors.newSingleThreadExecutor()
  private var generation = 0L
  private var session: String? = null
  private var endpoint: String? = null
  private var token: String? = null
  private var pendingCall: Call? = null
  private var sending = false
  private var failures = 0
  private var state = "stopped"
  private var draining = false
  private val client by lazy {
    OkHttpClientProvider.getOkHttpClient().newBuilder()
      .followRedirects(false).followSslRedirects(false)
      .connectTimeout(10, TimeUnit.SECONDS).readTimeout(20, TimeUnit.SECONDS)
      .callTimeout(30, TimeUnit.SECONDS).build()
  }
  private val tick = Runnable { sendNext() }

  fun start(sessionId: String, url: String, bearer: String, finishing: Boolean = false) {
    stop()
    session = sessionId; endpoint = url; token = bearer
    draining = finishing
    state = "waiting"
    handler.post(tick)
  }

  fun stop() {
    generation++
    handler.removeCallbacks(tick)
    pendingCall?.cancel(); pendingCall = null
    sending = false; failures = 0
    session = null; endpoint = null; token = null
    state = "stopped"
    draining = false
  }

  fun finish(): Boolean {
    if (session == null || token == null) return false
    draining = true
    handler.removeCallbacks(tick)
    if (!sending) handler.post(tick)
    return true
  }

  fun sessionId(): String? = session

  fun status(): JSONObject = JSONObject().put("state", state).put("session_id", session ?: JSONObject.NULL)
    .put("finishing", draining)

  private fun sendNext() {
    val sessionId = session ?: return
    val bearer = token ?: return
    if (sending) return
    val batch = try { next(sessionId) } catch (_: Exception) {
      state = "access_required"; token = null; return
    }
    val closing = batch == null && draining
    if (batch == null && !closing) {
      state = "waiting"; handler.postDelayed(tick, 1000); return
    }
    val expected = generation
    val body = (batch?.toString() ?: "{}").toRequestBody("application/json".toMediaType())
    val destination = if (closing) endpoint!!.removeSuffix("/batches") + "/stop" else endpoint!!
    val request = Request.Builder().url(destination).header("Authorization", "Bearer $bearer")
      .header("Accept", "application/json").header("ngrok-skip-browser-warning", "1").post(body).build()
    val call = client.newCall(request)
    pendingCall = call; sending = true; state = "sending"
    executor.execute {
      var accepted = false
      var blocked = false
      try {
        call.execute().use { response ->
          blocked = response.code in listOf(401, 403, 404, 409, 422)
          if (response.isSuccessful) {
            val source = response.body?.source()
            source?.request(65537)
            val bytes = source?.buffer?.readByteArray(minOf(source.buffer.size, 65537)) ?: byteArrayOf()
            if (bytes.size <= 65536) {
              val result = JSONObject(String(bytes, Charsets.UTF_8))
              val data = result.optJSONObject("data")
              val predictions = data?.optJSONArray("predictions")
              if (closing) {
                accepted = result.optBoolean("success") && data?.optString("id") == sessionId &&
                  data.optString("status") == "stopped"
              } else {
              val windows = batch!!.getJSONArray("windows")
              accepted = result.optBoolean("success") &&
                data?.optString("version") == "rc-demo-inference-v1" &&
                data.optString("model_sha256") == "4812bc8090d396b414db06ed9e6373b078ba610d43e4adf5e7fbf54133c14d18" &&
                predictions?.length() == windows.length() &&
                (0 until windows.length()).all {
                  predictions.getJSONObject(it).optString("id") == windows.getJSONObject(it).getString("id")
                }
              }
            }
          }
        }
      } catch (_: Exception) { /* Retain the same batch identity for retry. */ }
      handler.post {
        if (expected != generation) return@post
        pendingCall = null; sending = false
        if (accepted) {
          if (closing) {
            try { complete(sessionId) }
            catch (_: Exception) { state = "storage_error"; return@post }
            stop(); return@post
          }
          try { acknowledge(sessionId, batch!!.getString("client_batch_id")) }
          catch (_: Exception) { state = "storage_error"; return@post }
          failures = 0; state = "waiting"; handler.post(tick)
        } else if (blocked) {
          state = "review_required"; token = null
        } else {
          failures = (failures + 1).coerceAtMost(6)
          state = "retrying"
          handler.postDelayed(tick, (1000L shl failures).coerceAtMost(30000))
        }
      }
    }
  }
}
