package com.jamjade.rcrecorder
import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
class RentalDriveMonitoringService : Service() {
  companion object { const val START = "rental-motion-start"; const val STOP = "rental-motion-stop"; private const val CHANNEL = "jamjade_rental_motion"; private const val ID = 32108
    fun canNotify(context: Context): Boolean {
      val manager = context.getSystemService(NotificationManager::class.java)
      return (Build.VERSION.SDK_INT < 33 || context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED) &&
        manager.areNotificationsEnabled() && (Build.VERSION.SDK_INT < 26 || manager.getNotificationChannel(CHANNEL)?.importance != NotificationManager.IMPORTANCE_NONE)
    }
    fun showFinishing(context: Context) {
      val builder = if (Build.VERSION.SDK_INT >= 26) Notification.Builder(context, CHANNEL) else Notification.Builder(context)
      builder.setSmallIcon(android.R.drawable.ic_menu_compass).setContentTitle("Drive Monitoring")
        .setContentText("Readings stopped. Finishing sync.").setOngoing(true).setShowWhen(false).setVisibility(Notification.VISIBILITY_PRIVATE)
      context.getSystemService(NotificationManager::class.java).notify(ID, builder.build())
    }
  }
  private val instanceId = java.util.UUID.randomUUID().toString()
  private var wakeLock: PowerManager.WakeLock? = null
  override fun onBind(intent: Intent?): IBinder? = null
  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent?.action == STOP) { RentalDriveMonitoring.get(this).stop(); return START_NOT_STICKY }
    val reservation = intent?.getStringExtra("reservation")
    if (intent?.action != START || reservation == null) { stopSelf(); return START_NOT_STICKY }
    try {
      check(canNotify(this))
      val manager = getSystemService(NotificationManager::class.java)
      if (Build.VERSION.SDK_INT >= 26) manager.createNotificationChannel(NotificationChannel(CHANNEL, "Rental motion monitoring", NotificationManager.IMPORTANCE_LOW))
      val stop = PendingIntent.getService(this, 3, Intent(this, RentalDriveMonitoringService::class.java).setAction(STOP), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
      val builder = if (Build.VERSION.SDK_INT >= 26) Notification.Builder(this, CHANNEL) else Notification.Builder(this)
      builder.setSmallIcon(android.R.drawable.ic_menu_compass).setContentTitle("Drive Monitoring")
        .setContentText("RC motion readings are active.").setOngoing(true).setShowWhen(false).setVisibility(Notification.VISIBILITY_PRIVATE)
        .addAction(Notification.Action.Builder(null, "Stop motion", stop).build())
      packageManager.getLaunchIntentForPackage(packageName)?.let { builder.setContentIntent(PendingIntent.getActivity(this, 4, it, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)) }
      if (Build.VERSION.SDK_INT >= 34) startForeground(ID, builder.build(), ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE) else startForeground(ID, builder.build())
      wakeLock = (getSystemService(POWER_SERVICE) as PowerManager).newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "JamJade:RentalMotion").apply { setReferenceCounted(false); acquire(28_800_000) }
      RentalDriveMonitoring.get(this).begin(reservation, instanceId)
    } catch (_: Exception) { RentalDriveMonitoring.get(this).cancel(reservation); stopSelf() }
    return START_NOT_STICKY
  }
  override fun onTaskRemoved(rootIntent: Intent?) { RentalDriveMonitoring.get(this).stop(); super.onTaskRemoved(rootIntent) }
  override fun onDestroy() {
    RentalDriveMonitoring.get(this).serviceEnded(instanceId)
    if (wakeLock?.isHeld == true) wakeLock?.release()
    wakeLock = null; stopForeground(STOP_FOREGROUND_REMOVE); super.onDestroy()
  }
}
