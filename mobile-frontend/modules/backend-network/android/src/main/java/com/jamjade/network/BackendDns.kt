package com.jamjade.network

import java.io.IOException
import java.net.InetAddress
import java.net.UnknownHostException
import okhttp3.Dns

data class DnsAnswer(val addresses: List<InetAddress>, val ttlSeconds: Long)

fun interface BackendLookup {
  fun resolve(hostname: String): DnsAnswer
}

/** Only a failed system lookup for an exact configured backend can use DoH. */
class BackendDns(
  private val hosts: Set<String>,
  private val system: Dns = Dns.SYSTEM,
  private val fallback: BackendLookup = GoogleDnsLookup(),
  private val clockNanos: () -> Long = System::nanoTime,
) : Dns {
  private data class Cached(val addresses: List<InetAddress>, val expires: Long)
  private val cache = mutableMapOf<String, Cached>()

  override fun lookup(hostname: String): List<InetAddress> {
    val original = try {
      val addresses = system.lookup(hostname)
      if (addresses.isNotEmpty()) return addresses
      UnknownHostException("System DNS returned no addresses")
    } catch (failure: UnknownHostException) {
      failure
    }
    val host = hostname.lowercase(java.util.Locale.ROOT)
    if (host !in hosts) throw original
    synchronized(cache) {
      val now = clockNanos()
      cache[host]?.let { if (now < it.expires) return it.addresses }
      cache.remove(host)
      try {
        val answer = fallback.resolve(host)
        if (answer.addresses.isEmpty()) throw IOException("DNS returned no addresses")
        val ttl = answer.ttlSeconds.coerceIn(0, 300)
        if (ttl > 0) cache[host] = Cached(answer.addresses, clockNanos() + ttl * 1_000_000_000L)
        return answer.addresses
      } catch (failure: IOException) {
        throw UnknownHostException("Backend hostname lookup failed").apply {
          initCause(failure)
          addSuppressed(original)
        }
      }
    }
  }
}
