package com.jamjade.rcrecorder

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.Context
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.os.PowerManager

/** Non-exported service; no sensors start from boot, null intents, or automatic service restart. */
class RcRecorderService : Service() {
  companion object {
    const val START = "com.jamjade.rcrecorder.START"
    const val STOP = "com.jamjade.rcrecorder.STOP"
    private const val CHANNEL = "jamjade_rc_recording"
    private const val NOTIFICATION = 32107
    fun canNotify(context: Context): Boolean {
      val manager = context.getSystemService(NotificationManager::class.java)
      return (Build.VERSION.SDK_INT < 33 || context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED) &&
        manager.areNotificationsEnabled() && (Build.VERSION.SDK_INT < 26 || manager.getNotificationChannel(CHANNEL)?.importance != NotificationManager.IMPORTANCE_NONE)
    }
  }
  private var wakeLock: PowerManager.WakeLock? = null
  private var started = false
  private val instanceId = java.util.UUID.randomUUID().toString()
  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val engine = RcRecorderEngine.get(this)
    if (intent?.action == STOP) {
      engine.requestStop()
      return START_NOT_STICKY
    }
    if (intent?.action != START || intent.getStringExtra("config") == null || intent.getStringExtra("reservation") == null) {
      stopSelf(); return START_NOT_STICKY
    }
    if (started) {
      wakeLock?.acquire(engine.remainingLeaseMs().coerceAtMost(28800000))
      engine.begin(intent.getStringExtra("config")!!, intent.getStringExtra("reservation")!!, instanceId)
      return START_NOT_STICKY
    }
    try {
      check(canNotify(this))
      val notifications = getSystemService(NotificationManager::class.java)
      if (Build.VERSION.SDK_INT >= 26) notifications.createNotificationChannel(NotificationChannel(CHANNEL, "RC recording", NotificationManager.IMPORTANCE_LOW))
      val stop = PendingIntent.getService(this, 1, Intent(this, RcRecorderService::class.java).setAction(STOP), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
      val builder = if (Build.VERSION.SDK_INT >= 26) Notification.Builder(this, CHANNEL) else Notification.Builder(this)
      builder.setSmallIcon(android.R.drawable.ic_menu_compass).setContentTitle("RC recording")
        .setContentText("Motion is being saved on this phone.").setOngoing(true).setShowWhen(false)
        .setVisibility(Notification.VISIBILITY_PRIVATE).addAction(Notification.Action.Builder(null, "Stop recording", stop).build())
      packageManager.getLaunchIntentForPackage(packageName)?.let {
        builder.setContentIntent(PendingIntent.getActivity(this, 2, it, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE))
      }
      if (Build.VERSION.SDK_INT >= 34) startForeground(NOTIFICATION, builder.build(), ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)
      else startForeground(NOTIFICATION, builder.build())
      wakeLock = (getSystemService(POWER_SERVICE) as PowerManager).newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "JamJade:RcResearch").apply {
        setReferenceCounted(false)
        acquire(engine.remainingLeaseMs().coerceAtMost(28800000))
      }
      started = true
      engine.begin(intent.getStringExtra("config")!!, intent.getStringExtra("reservation")!!, instanceId)
    } catch (_: Exception) {
      engine.cancelStart(intent.getStringExtra("reservation")!!); stopSelf()
    }
    return START_NOT_STICKY
  }

  override fun onTaskRemoved(rootIntent: Intent?) {
    RcRecorderEngine.get(this).requestStop("task_removed")
    super.onTaskRemoved(rootIntent)
  }

  override fun onDestroy() {
    try { RcRecorderEngine.get(this).serviceEnded(instanceId) } finally {
      if (wakeLock?.isHeld == true) wakeLock?.release()
      wakeLock = null
      stopForeground(STOP_FOREGROUND_REMOVE)
      super.onDestroy()
    }
  }
}
