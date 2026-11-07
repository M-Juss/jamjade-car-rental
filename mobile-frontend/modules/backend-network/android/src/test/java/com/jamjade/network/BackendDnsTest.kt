package com.jamjade.network

import java.io.IOException
import java.net.InetAddress
import java.net.UnknownHostException
import okhttp3.Dns
import org.junit.Assert.*
import org.junit.Test

class BackendDnsTest {
  private val host = "api.example.com"
  private val address = InetAddress.getByAddress(byteArrayOf(8, 8, 8, 8))
  private fun system(action: (String) -> List<InetAddress>) = object : Dns {
    override fun lookup(hostname: String) = action(hostname)
  }
  private val missing = system { throw UnknownHostException("missing") }

  @Test fun successfulSystemDnsNeverCallsGoogle() {
    val dns = BackendDns(setOf(host), system { listOf(address) }, BackendLookup { error("Must not query Google") })
    assertEquals(listOf(address), dns.lookup(host))
  }

  @Test fun unconfiguredHostsAndSubdomainsNeverUseFallback() {
    val dns = BackendDns(setOf(host), missing, BackendLookup { error("Must not query Google") })
    for (name in listOf("other.example.com", "sub.$host", "dns.google", "localhost")) {
      assertThrows(UnknownHostException::class.java) { dns.lookup(name) }
    }
  }

  @Test fun failedSystemDnsUsesFallbackAndHonoursTtl() {
    var now = 0L
    var queries = 0
    val dns = BackendDns(setOf(host), missing, BackendLookup {
      assertEquals(host, it); queries++; DnsAnswer(listOf(address), 10)
    }, { now })
    assertEquals(listOf(address), dns.lookup(host))
    now = 9_000_000_000
    dns.lookup(host)
    assertEquals(1, queries)
    now = 10_000_000_000
    dns.lookup(host)
    assertEquals(2, queries)
  }

  @Test fun recoveredSystemDnsTakesPrecedenceOverCachedFallback() {
    var recovered = false
    val dns = BackendDns(setOf(host), system {
      if (!recovered) throw UnknownHostException("missing")
      listOf(address)
    }, BackendLookup { DnsAnswer(listOf(InetAddress.getByAddress(byteArrayOf(1, 1, 1, 1))), 60) })
    assertNotEquals(listOf(address), dns.lookup(host))
    recovered = true
    assertEquals(listOf(address), dns.lookup(host))
  }

  @Test fun ttlIsCappedAndZeroTtlIsNotCached() {
    for (ttl in listOf(0L, 1000L)) {
      var now = 0L
      var calls = 0
      val dns = BackendDns(setOf(host), missing, BackendLookup { calls++; DnsAnswer(listOf(address), ttl) }, { now })
      dns.lookup(host)
      now = 300_000_000_000
      dns.lookup(host)
      assertEquals(2, calls)
    }
  }

  @Test fun failedFallbackIsNotCachedAndPreservesDnsFailure() {
    var calls = 0
    val dns = BackendDns(setOf(host), missing, BackendLookup { calls++; throw IOException("unavailable") })
    repeat(2) {
      val failure = assertThrows(UnknownHostException::class.java) { dns.lookup(host) }
      assertTrue(failure.cause is IOException)
    }
    assertEquals(2, calls)
  }
}
