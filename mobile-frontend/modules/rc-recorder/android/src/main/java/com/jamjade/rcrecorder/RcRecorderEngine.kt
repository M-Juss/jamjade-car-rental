package com.jamjade.rcrecorder

import android.app.Application
import android.content.Context
import android.content.Intent
import android.content.res.Configuration
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.Build
import android.os.Handler
import android.os.HandlerThread
import android.os.SystemClock
import android.view.Surface
import android.view.WindowManager
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import java.util.UUID
import java.util.concurrent.FutureTask
import java.util.concurrent.TimeUnit

/** One native actor owns sensors and files. UI polling is optional and never drives capture. */
internal class RcRecorderEngine private constructor(private val context: Application) : SensorEventListener {
  companion object {
    @Volatile private var instance: RcRecorderEngine? = null
    fun get(context: Context): RcRecorderEngine = instance ?: synchronized(this) {
      instance ?: RcRecorderEngine(context.applicationContext as Application).also { instance = it }
    }
    private fun utc(ms: Long = System.currentTimeMillis()) = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US)
      .apply { timeZone = TimeZone.getTimeZone("UTC") }.format(Date(ms))
  }

  private val thread = HandlerThread("jamjade-rc-recorder").apply { start() }
  private val handler = Handler(thread.looper)
  private val manager = context.getSystemService(Context.SENSOR_SERVICE) as SensorManager
  private val clockContextId = UUID.randomUUID().toString()
  private var owner: String? = null
  @Volatile private var permitted = false
  private var leaseEnd = 0L
  private val setupCheck = SetupCheck(manager, handler) { permitted && SystemClock.elapsedRealtimeNanos() < leaseEnd }
  private var store: RecorderStore? = null
  private var manifest: JSONObject? = null
  private var activeId: String? = null
  private var pendingToken: String? = null
  private val pending: Boolean get() = pendingToken != null
  private var serviceId: String? = null
  private var serviceClosing = false
  private var lastError: String? = null
  private var collectionSessionId = UUID.randomUUID().toString()
  private var contextSignature: String? = null
  private val statistics = linkedMapOf<String, ChannelStatistics>()
  private val writers = linkedMapOf<String, RecorderStore.ChannelWriter>()
  private val registered = linkedMapOf<Int, String>()
  private var lastWallAnchor = 0L
  private var lastMonoAnchor = 0L

  fun <T> call(action: () -> T): T {
    if (android.os.Looper.myLooper() == thread.looper) return action()
    val task = FutureTask(action)
    handler.post(task)
    return try { task.get(30, TimeUnit.SECONDS) } catch (failure: java.util.concurrent.TimeoutException) {
      task.cancel(false); throw IllegalStateException("Recorder is busy. Try again.")
    } catch (failure: java.util.concurrent.ExecutionException) {
      throw failure.cause ?: failure
    }
  }

  fun authorize(ownerId: String, seconds: Int) = call {
    require(Regex("[1-9][0-9]{0,18}").matches(ownerId) && seconds in 1..28800) { "Research authorization is unavailable" }
    val next = RecorderStore.hash("rc-local-owner:$ownerId".toByteArray(Charsets.UTF_8))
    if (owner != null && owner != next) { setupCheck.cancel(); stopInternal("account_changed") }
    if (owner != next) { collectionSessionId = UUID.randomUUID().toString(); contextSignature = null; manifest = null; lastError = null }
    owner = next; leaseEnd = SystemClock.elapsedRealtimeNanos() + seconds * 1000000000L; permitted = true
    store = RecorderStore(context, next)
  }

  fun lock() {
    permitted = false
    call { try { setupCheck.cancel(); stopInternal("signed_out") } finally { owner = null; leaseEnd = 0; store = null; manifest = null } }
  }

  private fun authorized(): RecorderStore {
    check(permitted && owner != null && store != null && SystemClock.elapsedRealtimeNanos() < leaseEnd) { "Research access expired. Connect and verify access again." }
    return store!!
  }

  fun reserveStart(config: String) = call {
    authorized()
    check(activeId == null && !pending) { "A recording is already active" }
    check(!serviceClosing) { "The previous recording is finishing. Try again." }
    check(RcRecorderService.canNotify(context)) { "Enable recording notifications before starting" }
    check(!setupCheck.running) { "Wait for setup checks to finish" }
    validateContext(JSONObject(config))
    validateCollection(JSONObject(config))
    check(manager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER) != null && manager.getDefaultSensor(Sensor.TYPE_GYROSCOPE) != null) {
      "Accelerometer and gyroscope are required"
    }
    check(store!!.capacityAvailable()) { "Recording storage is full. Delete unwanted local recordings." }
    lastError = null
    manifest = null // A newly preparing trial must never display the previous trial's summary.
    val reservation = UUID.randomUUID().toString()
    pendingToken = reservation
    handler.postDelayed({
      if (pendingToken == reservation) {
        lastError = "Recording service did not start. Try again."
        stopInternal("start_failed")
      }
    }, 10000)
    reservation
  }

  fun cancelStart(reservation: String) = call {
    if (pendingToken == reservation) {
      pendingToken = null
      lastError = "Recording service could not start. Check notifications and available storage."
    }
  }

  fun begin(config: String, reservation: String, instanceId: String) { handler.post {
    if (pendingToken != reservation) {
      if (!pending && activeId == null) context.stopService(Intent(context, RcRecorderService::class.java))
      return@post
    }
    serviceId = instanceId
    try {
      val local = authorized()
      check(pending && activeId == null)
      val input = JSONObject(config)
      val evidence = validateCollection(input)
      val details = validateContext(input)
      val physical = JSONObject(details.toString()).apply { remove("name"); remove("recording_kind"); remove("consent") }
      val signature = RecorderStore.canonical(physical)
      if (contextSignature != signature) collectionSessionId = UUID.randomUUID().toString()
      contextSignature = signature
      val allocated = local.allocateRecording(details.getString("recording_group_id"))
      details.put("name", allocated.first).put("recording_number", allocated.second)
      val id = UUID.randomUUID().toString()
      val before = SystemClock.elapsedRealtimeNanos()
      val wall = System.currentTimeMillis()
      val after = SystemClock.elapsedRealtimeNanos()
      val start = before + (after - before) / 2
      lastWallAnchor = wall; lastMonoAnchor = start
      statistics.clear(); writers.clear(); registered.clear()
      val inventory = JSONObject()
      for ((channel, type) in RecorderStore.channels) {
        val sensor = manager.getDefaultSensor(type)
        val info = JSONObject().put("sensor_type", type).put("availability", if (sensor == null) "unavailable" else "available")
          .put("unit", if (channel == "gyroscope") "rad/s" else if (channel == "rotation_vector") "native_rotation_vector" else "m/s²")
          .put("sampling_period_us", 20000).put("max_report_latency_us", 0)
          .put("value_layout", JSONArray(if (channel == "rotation_vector") listOf("x_sin_half_angle", "y_sin_half_angle", "z_sin_half_angle", "cos_half_angle_optional", "heading_accuracy_rad_optional") else listOf("x", "y", "z")))
          .put("observed_value_counts", JSONArray())
        if (sensor != null) info.put("name", sensor.name).put("vendor", sensor.vendor).put("version", sensor.version)
          .put("maximum_range", sensor.maximumRange.toDouble()).put("resolution", sensor.resolution.toDouble())
          .put("min_delay_us", sensor.minDelay).put("max_delay_us", sensor.maxDelay).put("wake_up", sensor.isWakeUpSensor)
        inventory.put(channel, info)
        statistics[channel] = ChannelStatistics()
      }
      val rotation = (context.getSystemService(Context.WINDOW_SERVICE) as WindowManager).defaultDisplay.rotation
      val portrait = context.resources.configuration.orientation == Configuration.ORIENTATION_PORTRAIT
      val normalRotation = rotation == Surface.ROTATION_0 || rotation == Surface.ROTATION_180
      val natural = if (context.resources.configuration.orientation == Configuration.ORIENTATION_UNDEFINED) "unknown"
        else if (portrait == normalRotation) "portrait" else "landscape"
      val version = context.packageManager.getPackageInfo(context.packageName, 0)
      val record = JSONObject().put("protocol_version", 2).put("source", "android_sensor_manager_v2")
        .put("recording_id", id).put("collection_session_id", collectionSessionId).put("context", details)
        .put("coordinate_frame", "android_device_natural").put("natural_orientation", natural).put("screen_rotation", rotation)
        .put("started_elapsed_ns", start.toString()).put("started_at_utc", utc(wall)).put("state", "preparing")
        .put("duration_ms", 0).put("channels", inventory).put("chunks", JSONArray()).put("clock_anchors", JSONArray()).put("diagnostics", JSONArray())
        .put("lifecycle", JSONArray().put(JSONObject().put("state", "preparing").put("elapsed_ns", start.toString())))
        .put("device", JSONObject().put("manufacturer", Build.MANUFACTURER).put("model", Build.MODEL)
          .put("android_release", Build.VERSION.RELEASE).put("android_api", Build.VERSION.SDK_INT)
          .put("app_version", version.versionName).put("app_build", if (Build.VERSION.SDK_INT >= 28) version.longVersionCode.toString() else version.versionCode.toString())
          .put("native_adapter_version", "1.3.0"))
        .put("consent_version", 3).put("annotation_state", "unlabeled").put("transfer_state", "local_only")
        .put("stationary_reference_id", JSONObject.NULL).put("forward_reference_id", JSONObject.NULL)
        .put("diagnostics_partial", false).put("integrity", "recording")
        .put("limits", JSONObject().put("recording_bytes", RecorderStore.RECORD_LIMIT).put("owner_bytes", RecorderStore.OWNER_LIMIT)
          .put("minimum_free_bytes", RecorderStore.FREE_RESERVE).put("chunk_bytes", 1048576).put("chunk_duration_ms", 10000)
          .put("checkpoint_target_ms", 1000).put("required_sensor_startup_timeout_ms", 3000).put("required_sensor_stall_timeout_ms", 5000))
      val power = PhonePower.snapshot(context)
      record.put("phone_power", JSONObject().put("start", power).put("latest", power).put("end", JSONObject.NULL)
        .put("changes", JSONArray()).put("omitted_changes", 0))
      record.getJSONArray("clock_anchors").put(JSONObject().put("utc", utc(wall)).put("elapsed_ns", start.toString())
        .put("uncertainty_ns", (after - before).toString()))
      val collectionDocument = if (evidence != null) {
        val catalog = JSONObject(context.assets.open("rc-exercises-v1.json").bufferedReader().use { it.readText() })
        val protocols = catalog.getJSONArray("protocols")
        val protocol = (0 until protocols.length()).map { protocols.getJSONObject(it) }.first { it.getString("code") == input.getString("protocol_code") }
        local.workflow().bind(id, allocated.second, protocol, evidence)
      } else null
      if (collectionDocument != null) {
        record.put("collection_binding", JSONObject().put("contract_version", CollectionWorkflow.VERSION)
          .put("research_session_id", collectionDocument.getJSONObject("session").getString("id"))
          .put("mount_version_id", collectionDocument.getJSONObject("mount").getString("id"))
          .put("preflight_id", evidence!!.getString("id")).put("clock_context_id", clockContextId)
          .put("catalog_version", CollectionWorkflow.CATALOG).put("protocol_code", input.getString("protocol_code"))
          .put("protocol_sha256", collectionDocument.getString("protocol_sha256")))
      }
      local.create(id, record)
      if (collectionDocument != null) {
        local.saveCollection(id, collectionDocument)
        setupCheck.cancel() // One use; a failed/interrupted start never reuses setup evidence.
      }
      manifest = record; activeId = id; pendingToken = null
      for ((channel, type) in RecorderStore.channels) {
        val sensor = manager.getDefaultSensor(type) ?: continue
        val success = manager.registerListener(this, sensor, 20000, 0, handler)
        inventory.getJSONObject(channel).put("availability", if (success) "registered" else "registration_failed")
        if (success) { registered[type] = channel; writers[channel] = local.writer(id, channel, statistics.getValue(channel)) }
      }
      check(registered.containsKey(1) && registered.containsKey(4)) { "Required sensors could not be registered" }
      record.put("state", "recording")
      record.getJSONArray("lifecycle").put(JSONObject().put("state", "recording").put("elapsed_ns", SystemClock.elapsedRealtimeNanos().toString()))
      local.writeManifest(id, record)
      handler.postDelayed(tick, 1000)
    } catch (_: Exception) {
      lastError = "Recording could not start. Check sensors and available storage."
      pendingToken = null
      if (activeId != null) stopInternal("start_failed")
      else { serviceClosing = true; context.stopService(Intent(context, RcRecorderService::class.java)) }
    }
  } }

  override fun onSensorChanged(event: SensorEvent) {
    val record = manifest ?: return
    if (record.optString("state") != "recording") return
    val channel = registered[event.sensor.type] ?: return
    val receipt = SystemClock.elapsedRealtimeNanos()
    if (!permitted || receipt >= leaseEnd) { stopInternal(if (permitted) "authorization_expired" else "signed_out"); return }
    val stats = statistics.getValue(channel)
    val values = event.values.copyOf() // Android reuses SensorEvent instances.
    val start = record.getString("started_elapsed_ns").toLong()
    val expected = if (channel == "rotation_vector") values.size in 3..5 else values.size == 3
    if (!expected) { stats.received++; stats.rejected++; reject(channel, stats.received - 1, event.timestamp, "invalid_value_count"); return }
    if (!stats.observe(event.timestamp, receipt, values, event.accuracy, start)) {
      reject(channel, stats.received - 1, event.timestamp, if (event.timestamp < 0) "invalid_timestamp" else "nonfinite_value"); return
    }
    val observedCounts = record.getJSONObject("channels").getJSONObject(channel).getJSONArray("observed_value_counts")
    if ((0 until observedCounts.length()).none { observedCounts.getInt(it) == values.size }) observedCounts.put(values.size)
    val row = JSONObject().put("sequence", stats.received - 1).put("sensor_timestamp_ns", event.timestamp.toString())
      .put("received_elapsed_ns", receipt.toString()).put("accuracy", event.accuracy).put("values", JSONArray(values.map { it.toDouble() }))
    try { writers.getValue(channel).append(row, receipt) } catch (_: Exception) { stopInternal("write_failed") }
  }

  override fun onAccuracyChanged(sensor: Sensor?, value: Int) {} // Each event retains its reported accuracy code.

  private fun reject(channel: String, sequence: Long, timestamp: Long, reason: String) {
    val diagnostics = manifest?.getJSONArray("diagnostics") ?: return
    diagnostics.put(JSONObject().put("channel", channel).put("sequence", sequence).put("sensor_timestamp_ns", timestamp.toString()).put("reason", reason))
    if (diagnostics.length() >= 128) stopInternal("rejection_limit")
  }

  private val tick = object : Runnable {
    override fun run() {
      if (activeId == null) return
      val local = store ?: return
      val id = activeId ?: return
      val now = SystemClock.elapsedRealtimeNanos()
      when {
        !permitted -> { stopInternal("signed_out"); return }
        !RcRecorderService.canNotify(context) -> { stopInternal("notifications_disabled"); return }
        now >= leaseEnd -> { stopInternal("authorization_expired"); return }
        !local.capacityAvailable() || local.recordingBytes(id) >= RecorderStore.RECORD_LIMIT -> { stopInternal("storage_limit"); return }
      }
      val start = manifest!!.getString("started_elapsed_ns").toLong()
      if (now - start > 3000000000L && listOf("accelerometer", "gyroscope").any { statistics.getValue(it).lastNs == null }) {
        stopInternal("required_sensor_no_data"); return
      }
      if (listOf("accelerometer", "gyroscope").any { statistics.getValue(it).lastNs?.let { last -> now - last > 5000000000L } == true }) {
        stopInternal("required_sensor_stalled"); return
      }
      try {
        writers.values.forEach { it.checkpoint() }
        updateManifest(now)
        PhonePower.update(manifest!!, context)
        val wall = System.currentTimeMillis()
        if (kotlin.math.abs((wall - lastWallAnchor) - (now - lastMonoAnchor) / 1000000) > 1000) {
          manifest!!.getJSONArray("clock_anchors").put(JSONObject().put("utc", utc(wall)).put("elapsed_ns", now.toString())
            .put("uncertainty_ns", JSONObject.NULL).put("reason", "wall_clock_changed"))
          lastWallAnchor = wall; lastMonoAnchor = now
        }
        local.writeManifest(id, manifest!!)
        handler.postDelayed(this, 1000)
      } catch (_: Exception) { stopInternal("write_failed") }
    }
  }

  private fun updateManifest(now: Long) {
    val record = manifest ?: return
    val start = record.getString("started_elapsed_ns").toLong()
    record.put("duration_ms", (now - start).coerceAtLeast(0) / 1e6)
    val inventory = record.getJSONObject("channels")
    for ((channel, stats) in statistics) inventory.getJSONObject(channel).put("statistics", statsJson(stats, start, now))
    record.put("chunks", JSONArray(writers.values.flatMap { it.descriptors() }))
  }

  fun stop(reason: String = "operator_stopped") = call { stopInternal(reason) }
  fun requestStop(reason: String = "operator_stopped") { handler.post { stopInternal(reason) } }
  private fun stopInternal(reason: String) {
    pendingToken = null
    if (serviceId != null) serviceClosing = true
    val id = activeId
    if (id == null) { context.stopService(Intent(context, RcRecorderService::class.java)); return }
    handler.removeCallbacks(tick)
    manager.unregisterListener(this)
    val record = manifest!!
    record.put("state", "stopping")
    var complete = true
    writers.values.forEach { writer -> try { writer.seal() } catch (_: Exception) { complete = false } }
    val end = SystemClock.elapsedRealtimeNanos()
    updateManifest(end)
    PhonePower.update(record, context, true)
    val inventory = record.getJSONObject("channels")
    for ((channel, stats) in statistics) if (stats.received == 0L && inventory.getJSONObject(channel).optString("availability") == "registered")
      inventory.getJSONObject(channel).put("availability", "no_data")
    val stopped = complete && reason == "operator_stopped"
    record.put("state", if (stopped) "stopped" else "interrupted").put("end_reason", if (complete) reason else "write_failed")
      .put("ended_elapsed_ns", end.toString()).put("ended_at_utc", utc()).put("integrity", if (complete) "sealed" else "unverified_tail")
      .put("end_time_source", "native_stop")
      .put("chunk_inventory_sha256", RecorderStore.hash(RecorderStore.canonical(record.getJSONArray("chunks")).toByteArray(Charsets.UTF_8)))
    record.getJSONArray("lifecycle").put(JSONObject().put("state", record.getString("state")).put("reason", record.getString("end_reason")).put("elapsed_ns", end.toString()))
    try { store!!.writeManifest(id, record) } catch (_: Exception) {
      record.put("state", "interrupted").put("end_reason", "write_failed").put("integrity", "unverified_tail")
    }
    activeId = null; registered.clear(); writers.clear()
    context.stopService(Intent(context, RcRecorderService::class.java))
  }

  fun serviceEnded(instanceId: String) { handler.post {
    if (serviceId == instanceId) {
      serviceId = null; serviceClosing = false
      if (activeId != null || pending) stopInternal("service_interrupted")
    }
  } }
  fun remainingLeaseMs() = call { ((leaseEnd - SystemClock.elapsedRealtimeNanos()) / 1000000).coerceAtLeast(1) }
  fun state() = call {
    val local = authorized()
    if (activeId != null) updateManifest(SystemClock.elapsedRealtimeNanos())
    JSONObject().put("active", activeId != null || pending).put("preparing", pending).put("error", lastError ?: JSONObject.NULL)
      .put("setup_check", setupCheck.result() ?: JSONObject.NULL).put("checking", setupCheck.running)
      .put("phone_power", PhonePower.snapshot(context))
      .put("current", manifest?.let { local.summary(it) } ?: JSONObject.NULL)
  }
  fun list(offset: Int) = call { authorized().list(offset, activeId) }
  fun listCollection(offset: Int, filter: String) = call { authorized().list(offset, activeId, filter) }
  fun groups() = call { authorized().groups() }
  fun exportManifest(id: String) = call {
    check(activeId == null && !pending) { "Stop recording before uploading" }
    authorized().exportManifest(id)
  }
  fun exportChunk(id: String, channel: String, index: Int) = call {
    check(activeId == null && !pending) { "Stop recording before uploading" }
    authorized().exportChunk(id, channel, index)
  }
  fun setTransfer(id: String, value: String) = call { authorized().setTransfer(id, JSONObject(value)) }
  fun createGroup(config: String) = call {
    check(activeId == null && !pending) { "Stop recording before creating a group" }
    authorized().createGroup(ResearchSetup.group(JSONObject(config)), utc())
  }
  fun details(id: String) = call {
    val local = authorized()
    val record = if (id == activeId) { updateManifest(SystemClock.elapsedRealtimeNanos()); JSONObject(manifest.toString()) }
    else local.recover(id)
    local.summary(record)
  }
  fun delete(id: String) = call {
    check(id != activeId) { "Stop the recording before deleting it" }
    authorized().delete(id)
    if (manifest?.optString("recording_id") == id) manifest = null
  }

  fun collectionAction(config: String) = call {
    val local = authorized()
    check(activeId == null && !pending && !setupCheck.running) { "Stop capture before changing the setup" }
    val value = JSONObject(config)
    when (value.getString("action")) {
      "current" -> local.workflow().current()
      "open" -> { setupCheck.cancel(); local.workflow().open(local.group(value.getString("group_id")), utc()) }
      "mount" -> { setupCheck.cancel(); local.workflow().mount(value.getString("reason"), utc()) }
      else -> error("Unknown setup action")
    }
  }
  fun beginCheck() = call {
    val local = authorized()
    check(activeId == null && !pending && !setupCheck.running) { "Another capture is active" }
    val mount = local.workflow().current().getJSONObject("mount")
    val consentTime = utc()
    setupCheck.start(mount.getString("id"), clockContextId, consentTime, consentTime)
  }
  fun cancelCheck() = call { setupCheck.cancel() }
  fun collection(id: String) = call { authorized().collection(id) ?: JSONObject.NULL }
  fun saveObservation(id: String, config: String) = call {
    val local = authorized()
    check(id != activeId && !pending) { "Stop and save first" }
    val record = local.recover(id)
    check(record.getString("state") in setOf("stopped", "interrupted"))
    val document = local.workflow().observe(local.collection(id), JSONObject(config), utc())
    val flags = JSONObject(config).getJSONArray("flags")
    if ((0 until flags.length()).any { flags.getString(it) in setOf("phone_shift", "holder_loose") }) {
      val currentMount = local.workflow().current().optJSONObject("mount")
      if (currentMount != null && document.optJSONObject("mount")?.optString("id") == currentMount.optString("id")) {
        local.workflow().mount("suspected_shift", utc()); setupCheck.cancel()
      }
    }
    local.saveCollection(id, document)
    document
  }
  fun collectionReceipt(id: String, config: String) = call {
    val local = authorized(); val document = local.collection(id) ?: error("Collection details unavailable")
    val value = JSONObject(config)
    require(value.keys().asSequence().toSet() == setOf("context_synced", "observation_revision", "annotation_state", "checked_at"))
    require(value.getBoolean("context_synced"))
    require(value.getInt("observation_revision") in 0..(document.optJSONArray("observations")?.length() ?: 0))
    require(value.getString("annotation_state") in setOf("unlabeled", "uncertain", "reviewed", "labeled"))
    document.put("sync", value); local.saveCollection(id, document)
  }
  private fun validateCollection(value: JSONObject): JSONObject? {
    if (!value.has("protocol_code") && !value.has("preflight_id")) return null // Installed old clients keep their original contract.
    val local = authorized(); val current = local.workflow().current()
    val evidence = setupCheck.result() ?: error("Run setup checks before recording")
    check(evidence.getString("id") == value.getString("preflight_id") && evidence.getString("result") != "failed") { "Repeat setup checks before recording" }
    check(evidence.getString("clock_context_id") == clockContextId && evidence.getString("mount_version_id") == current.getJSONObject("mount").getString("id"))
    val session = current.getJSONObject("session")
    check(session.getString("recording_group_id") == value.getString("recording_group_id"))
    check(session.getJSONObject("conditions").getString("surface") == value.getString("surface") && session.getJSONObject("conditions").getString("slope") == value.getString("slope"))
    val catalog = JSONObject(context.assets.open("rc-exercises-v1.json").bufferedReader().use { it.readText() })
    val protocols = catalog.getJSONArray("protocols")
    val protocol = (0 until protocols.length()).map { protocols.getJSONObject(it) }.firstOrNull { it.getString("code") == value.optString("protocol_code") } ?: error("Choose an exercise")
    check(protocol.getString("recording_kind") == value.getString("recording_kind"))
    return JSONObject(evidence.toString())
  }
  private fun validateContext(value: JSONObject): JSONObject {
    val value = JSONObject(value.toString()).apply { remove("protocol_code"); remove("preflight_id") }
    val id = value.getString("recording_group_id")
    return ResearchSetup.recording(value, authorized().group(id))
  }
}
