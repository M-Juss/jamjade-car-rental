package com.jamjade.rcrecorder

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleOwner
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class RcRecorderModule : Module() {
  private fun context() = appContext.reactContext?.applicationContext ?: error("Recorder context is unavailable")
  private fun engine() = RcRecorderEngine.get(context())

  override fun definition() = ModuleDefinition {
    Name("JamJadeRcRecorder")
    AsyncFunction("rentalMonitoringDiscardStart") { RentalDriveMonitoring.get(context()).discardStart(); null }
    AsyncFunction("rentalMonitoringPrepare") { owner: String, booking: String -> RentalDriveMonitoring.get(context()).prepare(owner, booking) }
    AsyncFunction("rentalMonitoringStatus") { owner: String -> RentalDriveMonitoring.get(context()).status(owner) }
    AsyncFunction("rentalMonitoringStop") { RentalDriveMonitoring.get(context()).stop(); null }
    AsyncFunction("rentalMonitoringLock") { RentalDriveMonitoring.get(context()).lock(); null }
    AsyncFunction("rentalMonitoringRecover") { config: String ->
      require(config.length <= 8192)
      check(appContext.currentActivity?.hasWindowFocus() == true)
      RentalDriveMonitoring.get(context()).recover(config); null
    }
    AsyncFunction("rentalMonitoringStart") { config: String ->
      require(config.length <= 8192)
      check(appContext.currentActivity?.hasWindowFocus() == true) { "Open Telematics to start monitoring." }
      check(RentalDriveMonitoringService.canNotify(context())) { "Allow monitoring notifications first." }
      val engine = RentalDriveMonitoring.get(context())
      val reservation = engine.reserve(config)
      try {
        val intent = Intent(context(), RentalDriveMonitoringService::class.java).setAction(RentalDriveMonitoringService.START).putExtra("reservation", reservation)
        if (Build.VERSION.SDK_INT >= 26) context().startForegroundService(intent) else context().startService(intent)
      } catch (failure: Exception) { engine.cancel(reservation); throw failure }
      null
    }
    AsyncFunction("authorize") { ownerId: String, validForSeconds: Int -> engine().authorize(ownerId, validForSeconds); null }
    AsyncFunction("lock") { RentalDriveMonitoring.get(context()).lock(); engine().lock(); null }
    AsyncFunction("status") { engine().state().toString() }
    AsyncFunction("list") { offset: Int -> engine().list(offset).toString() }
    AsyncFunction("collectionPage") { offset: Int, filter: String -> engine().collectionPage(offset, filter).toString() }
    AsyncFunction("listCollection") { offset: Int, filter: String -> engine().listCollection(offset, filter).toString() }
    AsyncFunction("groups") { engine().groups().toString() }
    AsyncFunction("createGroup") { config: String ->
      require(config.length <= 2048) { "Group details are too large" }
      engine().createGroup(config).toString()
    }
    OnActivityEntersBackground { engine().cancelRentalMotion(); engine().cancelCheck() }
    OnDestroy { engine().cancelRentalMotion(); engine().cancelCheck() }
    AsyncFunction("beginRentalMotion") { seconds: Int ->
      // The calibration dialog owns window focus while its host is still resumed.
      val host = appContext.currentActivity as? LifecycleOwner
      check(host?.lifecycle?.currentState == Lifecycle.State.RESUMED) { "Open calibration before starting." }
      engine().beginRentalMotion(seconds)
    }.runOnQueue(Queues.MAIN)
    AsyncFunction("readRentalMotion") { id: String -> engine().readRentalMotion(id) }
    AsyncFunction("cancelRentalMotion") { id: String -> engine().cancelRentalMotion(id); null }
    AsyncFunction("collectionAction") { config: String ->
      require(config.length <= 512); engine().collectionAction(config).toString()
    }
    AsyncFunction("beginCheck") {
      check(appContext.currentActivity?.hasWindowFocus() == true) { "Open Data Collection before checking" }
      engine().beginCheck(); null
    }
    AsyncFunction("cancelCheck") { engine().cancelCheck(); null }
    AsyncFunction("collection") { id: String -> engine().collection(id).toString() }
    AsyncFunction("saveObservation") { id: String, config: String ->
      require(config.length <= 8192); engine().saveObservation(id, config).toString()
    }
    AsyncFunction("collectionReceipt") { id: String, config: String ->
      require(config.length <= 1024); engine().collectionReceipt(id, config); null
    }
    AsyncFunction("details") { id: String -> engine().details(id).toString() }
    AsyncFunction("exportManifest") { id: String -> engine().exportManifest(id).toString() }
    AsyncFunction("exportChunk") { id: String, channel: String, index: Int -> engine().exportChunk(id, channel, index) }
    AsyncFunction("setTransfer") { id: String, value: String ->
      require(value.length <= 512)
      engine().setTransfer(id, value); null
    }
    AsyncFunction("delete") { id: String -> engine().delete(id); null }
    AsyncFunction("stop") { engine().stop(); null }
    AsyncFunction("configureDriveUpload") { config: String ->
      require(config.length <= 8192)
      check(appContext.currentActivity?.hasWindowFocus() == true) { "Open Drive Monitoring before connecting transfer." }
      engine().configureDriveUpload(config)
    }
    AsyncFunction("enqueueDriveBatch") { config: String ->
      require(config.length <= 200000)
      engine().enqueueDriveBatch(config)
    }
    AsyncFunction("driveUploadStatus") { engine().driveUploadStatus() }
    AsyncFunction("driveStartIdentity") { config: String -> require(config.length <= 1024); engine().driveStartIdentity(config) }
    AsyncFunction("clearDriveStartIdentity") { engine().clearDriveStartIdentity() }
    AsyncFunction("startDriveMonitoring") { config: String, runtime: String ->
      require(config.length <= 4096) { "Monitoring details are too large" }
      require(runtime.length <= 4096) { "Monitoring reference is too large" }
      val input = org.json.JSONObject(config)
      require(input.optString("protocol_code") == "MD") { "Choose Mixed Drive for monitoring." }
      check(appContext.currentActivity?.hasWindowFocus() == true) { "Open Drive Monitoring before starting." }
      check(RcRecorderService.canNotify(context())) { "Allow monitoring notifications before starting." }
      val reservation = engine().reserveDriveStart(config, runtime)
      try {
        val intent = Intent(context(), RcRecorderService::class.java).setAction(RcRecorderService.MONITOR)
          .putExtra("config", config).putExtra("reservation", reservation)
        if (Build.VERSION.SDK_INT >= 26) context().startForegroundService(intent) else context().startService(intent)
      } catch (failure: Exception) { engine().cancelStart(reservation); throw failure }
      null
    }
    AsyncFunction("start") { config: String ->
      require(config.length <= 4096) { "Recording details are too large" }
      check(appContext.currentActivity?.hasWindowFocus() == true) { "Open Data Collection before starting" }
      check(Build.VERSION.SDK_INT < 33 || context().checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED) {
        "Allow recording notifications before starting"
      }
      val reservation = engine().reserveStart(config)
      try {
        val intent = Intent(context(), RcRecorderService::class.java).setAction(RcRecorderService.START)
          .putExtra("config", config).putExtra("reservation", reservation)
        if (Build.VERSION.SDK_INT >= 26) context().startForegroundService(intent) else context().startService(intent)
      } catch (failure: Exception) { engine().cancelStart(reservation); throw failure }
      null
    }
  }
}
