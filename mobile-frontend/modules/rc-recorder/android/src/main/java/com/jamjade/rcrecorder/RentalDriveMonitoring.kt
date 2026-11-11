package com.jamjade.rcrecorder

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.Handler
import android.os.HandlerThread
import android.os.SystemClock
import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID
import java.util.concurrent.FutureTask

/** Rental feature queue is isolated from research originals; no tokens are persisted. */
internal class RentalDriveMonitoring private constructor(private val context: Context) : SensorEventListener {
  companion object {
    @Volatile private var instance: RentalDriveMonitoring? = null
    fun get(context: Context): RentalDriveMonitoring = instance ?: synchronized(this) {
      instance ?: RentalDriveMonitoring(context.applicationContext).also { instance = it }
    }
  }
  private val thread = HandlerThread("JamJadeRentalMotion").apply { start() }
  private val handler = Handler(thread.looper)
  private val manager = context.getSystemService(Context.SENSOR_SERVICE) as SensorManager
  private var store: RecorderStore? = null
  private var owner: String? = null
  private var active: String? = null
  private var booking: String? = null
  private var pipeline: DriveMotionPipeline? = null
  private var windows = JSONArray()
  private var error: String? = null
  private var reserved: String? = null
  private var startConfig: String? = null
  private var serviceId: String? = null
  private var lastAcceleration = 0L
  private var lastRotation = 0L
  private var origin = 0L
  private val uploader = DriveBatchUploader(handler,
    { sid -> val batches = store!!.driveUploadQueue().getJSONArray("batches");
      (0 until batches.length()).map { batches.getJSONObject(it) }.firstOrNull { it.getString("session_id") == sid }?.getJSONObject("payload") },
    { sid, bid -> val queue = store!!.driveUploadQueue(); DriveTransferQueue.acknowledge(queue, sid, bid); store!!.saveDriveUploadQueue(queue) },
    { sid -> val queue = store!!.driveUploadQueue(); DriveTransferQueue.complete(queue, sid); store!!.saveDriveUploadQueue(queue)
      context.stopService(android.content.Intent(context, RentalDriveMonitoringService::class.java)) })
  private fun <T> call(block: () -> T): T {
    if (android.os.Looper.myLooper() == handler.looper) return block()
    val task = FutureTask<T> { block() }; handler.post(task); return task.get()
  }
  private fun select(user: String) {
    require(user.matches(Regex("[1-9][0-9]{0,18}")))
    if (owner == user) return
    check(active == null && reserved == null) { "Stop monitoring before changing account." }
    uploader.stop()
    owner = user
    store = RecorderStore(context, RecorderStore.hash(user.toByteArray()), "rental-motion-v1")
    val queue = store!!.driveUploadQueue()
    val sessions = queue.optJSONObject("sessions") ?: JSONObject()
    sessions.keys().forEach { DriveTransferQueue.requestClose(queue, it) }
    store!!.saveDriveUploadQueue(queue)
  }
  fun discardStart() = call {
    check(active == null && reserved == null)
    val queue = store?.driveUploadQueue() ?: return@call
    queue.remove("start_intent"); store!!.saveDriveUploadQueue(queue)
  }
  fun prepare(user: String, code: String): String = call {
    select(user)
    require(code.matches(Regex("[A-Za-z0-9-]{1,100}")))
    check(active == null && reserved == null && serviceId == null) { "The previous monitoring session is still finishing." }
    val queue = store!!.driveUploadQueue()
    check((queue.optJSONObject("sessions")?.length() ?: 0) == 0) { "Finish the previous monitoring transfer first." }
    val intent = queue.optJSONObject("start_intent")
    if (intent != null) check(intent.getString("booking") == code) { "Reconnect the previous booking before starting another." }
    val id = intent?.getString("id") ?: UUID.randomUUID().toString()
    queue.put("start_intent", JSONObject().put("id", id).put("booking", code))
    store!!.saveDriveUploadQueue(queue)
    id
  }
  fun reserve(config: String): String = call {
    val input = JSONObject(config)
    select(input.getString("owner_id"))
    check(active == null && reserved == null && serviceId == null) { "The previous monitoring session is still finishing." }
    check((store!!.driveUploadQueue().optJSONObject("sessions")?.length() ?: 0) == 0) { "Finish pending transfer first." }
    validateDestination(input)
    DriveMotionPipeline(input.getJSONObject("reference"), 0L) { }
    RcRecorderEngine.get(context).claimRentalMonitoring()
    val id = UUID.randomUUID().toString()
    reserved = id; startConfig = config
    handler.postDelayed({ if (reserved == id) cancel(id) }, 10_000)
    id
  }
  private fun validateDestination(input: JSONObject) {
    val sid = input.getString("session_id"); require(UUID.fromString(sid).toString() == sid)
    val code = input.getString("booking_code"); require(code.matches(Regex("[A-Za-z0-9-]{1,100}")))
    val url = java.net.URI(input.getString("api_url"))
    @Suppress("DEPRECATION")
    val metadata = context.packageManager.getApplicationInfo(context.packageName, android.content.pm.PackageManager.GET_META_DATA).metaData
    val allowed = metadata?.getString("com.jamjade.network.BACKEND_DNS_HOSTS")?.split(',')?.toSet().orEmpty()
    require(url.scheme == "https" && url.host in allowed && url.userInfo == null && url.query == null && url.fragment == null &&
      url.path == "/api/mobile/bookings/$code/motion-monitoring/sessions/$sid/batches") { "Monitoring requires the configured secure backend." }
    val token = input.getString("token")
    require(token.isNotBlank() && token.length <= 4096 && !token.contains('\n') && !token.contains('\r'))
  }
  fun begin(reservation: String, instance: String) = call {
    check(reserved == reservation)
    val input = JSONObject(startConfig!!)
    serviceId = instance
    try {
      val sid = input.getString("session_id")
      val queue = store!!.driveUploadQueue()
      DriveTransferQueue.bind(queue, sid, sid)
      queue.getJSONObject("sessions").getJSONObject(sid).put("booking", input.getString("booking_code"))
      queue.remove("start_intent"); store!!.saveDriveUploadQueue(queue)
      active = sid; booking = input.getString("booking_code"); error = null; windows = JSONArray()
      origin = SystemClock.elapsedRealtimeNanos(); lastAcceleration = origin; lastRotation = origin
      pipeline = DriveMotionPipeline(input.getJSONObject("reference"), origin) { windows.put(it) }
      for (type in listOf(Sensor.TYPE_ACCELEROMETER, Sensor.TYPE_GYROSCOPE)) {
        val sensor = manager.getDefaultSensor(type) ?: error("Motion sensor unavailable.")
        check(manager.registerListener(this, sensor, MOTION_INTERVAL_US, 0, handler))
      }
      uploader.start(sid, input.getString("api_url"), input.getString("token"))
      reserved = null; startConfig = null
      handler.postDelayed(tick, 1000)
    } catch (failure: Exception) { stopInternal(); cancel(reservation); throw failure }
  }
  private val tick = object : Runnable {
    override fun run() {
      if (active == null) return
      try {
        check(SystemClock.elapsedRealtimeNanos() - origin < 28_800_000_000_000L) { "Monitoring time limit reached." }
        check(uploader.status().optString("state") !in setOf("review_required", "access_required", "storage_error")) { "Monitoring access changed. Reconnect to continue." }
        check(SystemClock.elapsedRealtimeNanos() - minOf(lastAcceleration, lastRotation) < 3_000_000_000L) { "Motion readings were interrupted." }
        flush(); handler.postDelayed(this, 1000)
      } catch (_: Exception) { error = "Motion monitoring stopped. Reconnect and finish pending transfer."; stopInternal() }
    }
  }
  private fun flush() {
    if (windows.length() == 0 || active == null) return
    val queue = store!!.driveUploadQueue()
    check(queue.getJSONArray("batches").length() < 100) { "Pending transfer storage is full." }
    val payload = JSONObject().put("version", "rc-demo-inference-v1").put("client_batch_id", UUID.randomUUID().toString()).put("windows", windows)
    queue.getJSONArray("batches").put(JSONObject().put("session_id", active).put("payload", payload))
    store!!.saveDriveUploadQueue(queue); windows = JSONArray()
  }
  fun serviceEnded(instance: String) = call {
    if (serviceId == instance) {
      serviceId = null
      if (active != null) stopInternal()
    }
  }
  fun stop() = call { reserved?.let { cancel(it) }; stopInternal() }
  private fun stopInternal() {
    manager.unregisterListener(this); handler.removeCallbacks(tick)
    try { flush() } catch (_: Exception) { error = "Pending motion storage is full. Some final readings could not be saved." }
    try {
      active?.let { sid ->
        val queue = store!!.driveUploadQueue(); DriveTransferQueue.requestClose(queue, sid); store!!.saveDriveUploadQueue(queue)
      }
    } catch (_: Exception) {
      error = "Readings stopped, but transfer needs storage recovery."
    } finally {
      active = null; pipeline = null
      RcRecorderEngine.get(context).releaseRentalMonitoring()
      if (serviceId != null) try { RentalDriveMonitoringService.showFinishing(context) } catch (_: Exception) { }
      if (!uploader.finish()) context.stopService(android.content.Intent(context, RentalDriveMonitoringService::class.java))
    }
  }
  fun cancel(id: String) = call {
    if (reserved == id) { reserved = null; startConfig = null; RcRecorderEngine.get(context).releaseRentalMonitoring() }
  }
  fun lock() = call { reserved?.let { cancel(it) }; stopInternal(); uploader.stop(); store = null; owner = null; booking = null }
  fun status(user: String): String = call {
    select(user)
    val queue = store!!.driveUploadQueue()
    val sessions = queue.optJSONObject("sessions") ?: JSONObject()
    uploader.status().put("active", active != null).put("booking_code", booking ?: JSONObject.NULL)
      .put("error", error ?: JSONObject.NULL).put("pending_batches", queue.getJSONArray("batches").length())
      .put("unfinished", JSONArray(sessions.keys().asSequence().map { sid ->
        JSONObject().put("id", sid).put("booking_code", sessions.getJSONObject(sid).getString("booking"))
      }.toList())).toString()
  }
  fun recover(config: String) = call {
    val input = JSONObject(config); select(input.getString("owner_id")); validateDestination(input)
    check(active == null && reserved == null)
    val queue = store!!.driveUploadQueue(); val sid = input.getString("session_id")
    check(DriveTransferQueue.closing(queue, sid))
    check(queue.getJSONObject("sessions").getJSONObject(sid).getString("booking") == input.getString("booking_code"))
    uploader.start(sid, input.getString("api_url"), input.getString("token"), true)
  }
  override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) = Unit
  override fun onSensorChanged(event: SensorEvent) {
    val live = pipeline ?: return
    if (event.timestamp < origin || SystemClock.elapsedRealtimeNanos() - event.timestamp > 250_000_000L || event.values.size < 3) return
    if (!(0..2).all { event.values[it].isFinite() }) return
    if (event.sensor.type == Sensor.TYPE_ACCELEROMETER) lastAcceleration = maxOf(lastAcceleration, event.timestamp) else lastRotation = maxOf(lastRotation, event.timestamp)
    live.accept(if (event.sensor.type == Sensor.TYPE_ACCELEROMETER) 0 else 1, event.timestamp, DoubleArray(3) { event.values[it].toDouble() })
    // A stalled actor must not build unbounded in-memory windows.
    if (windows.length() >= 75) try { flush() } catch (_: Exception) { error = "Motion storage is full. Reconnect to finish transfer."; stopInternal() }
  }
}
