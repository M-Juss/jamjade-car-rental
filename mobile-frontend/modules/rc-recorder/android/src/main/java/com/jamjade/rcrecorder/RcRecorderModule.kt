package com.jamjade.rcrecorder

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class RcRecorderModule : Module() {
  private fun context() = appContext.reactContext?.applicationContext ?: error("Recorder context is unavailable")
  private fun engine() = RcRecorderEngine.get(context())

  override fun definition() = ModuleDefinition {
    Name("JamJadeRcRecorder")
    AsyncFunction("authorize") { ownerId: String, validForSeconds: Int -> engine().authorize(ownerId, validForSeconds); null }
    AsyncFunction("lock") { engine().lock(); null }
    AsyncFunction("status") { engine().state().toString() }
    AsyncFunction("list") { offset: Int -> engine().list(offset).toString() }
    AsyncFunction("listCollection") { offset: Int, filter: String -> engine().listCollection(offset, filter).toString() }
    AsyncFunction("groups") { engine().groups().toString() }
    AsyncFunction("createGroup") { config: String ->
      require(config.length <= 2048) { "Group details are too large" }
      engine().createGroup(config).toString()
    }
    OnActivityEntersBackground { engine().cancelCheck() }
    OnDestroy { engine().cancelCheck() }
    AsyncFunction("collectionAction") { config: String ->
      require(config.length <= 512); engine().collectionAction(config).toString()
    }
    AsyncFunction("beginCheck") {
      check(appContext.currentActivity?.hasWindowFocus() == true) { "Open RC Research before checking" }
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
    AsyncFunction("start") { config: String ->
      require(config.length <= 4096) { "Recording details are too large" }
      check(appContext.currentActivity?.hasWindowFocus() == true) { "Open RC Research before starting" }
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
