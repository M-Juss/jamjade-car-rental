package com.jamjade.network

import android.app.Application
import android.content.Context
import android.content.pm.PackageManager
import com.facebook.react.modules.network.OkHttpClientProvider
import expo.modules.core.interfaces.ApplicationLifecycleListener
import expo.modules.core.interfaces.Package

class BackendNetworkPackage : Package {
  override fun createApplicationLifecycleListeners(context: Context): List<ApplicationLifecycleListener> =
    listOf(object : ApplicationLifecycleListener {
      override fun onCreate(application: Application) {
        @Suppress("DEPRECATION")
        val metadata = application.packageManager.getApplicationInfo(application.packageName, PackageManager.GET_META_DATA).metaData
        val hosts = metadata?.getString("com.jamjade.network.BACKEND_DNS_HOSTS")
          ?.split(',')?.filter { it.isNotBlank() }?.toSet().orEmpty()
        if (hosts.isEmpty()) return
        val dns = BackendDns(hosts)
        OkHttpClientProvider.setOkHttpClientFactory {
          OkHttpClientProvider.createClientBuilder(application).dns(dns).build()
        }
      }
    })
}
