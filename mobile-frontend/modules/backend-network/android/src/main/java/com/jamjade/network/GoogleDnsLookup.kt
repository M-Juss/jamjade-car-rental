package com.jamjade.network

import java.io.IOException
import java.net.InetAddress
import java.util.concurrent.TimeUnit
import okhttp3.CookieJar
import okhttp3.Dns
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.HttpUrl.Companion.toHttpUrl
import org.json.JSONException
import org.json.JSONObject

class GoogleDnsLookup(
  // This separate client has no application cookies, tokens, interceptors or cache.
  private val client: OkHttpClient = OkHttpClient.Builder()
    .dns(Dns.SYSTEM)
    .cookieJar(CookieJar.NO_COOKIES)
    .connectTimeout(2, TimeUnit.SECONDS)
    .readTimeout(2, TimeUnit.SECONDS)
    .callTimeout(2500, TimeUnit.MILLISECONDS)
    .followRedirects(false)
    .followSslRedirects(false)
    .retryOnConnectionFailure(false)
    .build(),
) : BackendLookup {
  override fun resolve(hostname: String): DnsAnswer {
    val url = "https://dns.google/resolve".toHttpUrl().newBuilder()
      .addQueryParameter("name", hostname)
      .addQueryParameter("type", "A")
      .addQueryParameter("edns_client_subnet", "0.0.0.0/0")
      .build()
    val request = Request.Builder().url(url).header("Accept", "application/json").build()
    client.newCall(request).execute().use { response ->
      if (!response.isSuccessful) throw IOException("Encrypted DNS request failed")
      val source = response.body?.source() ?: throw IOException("Missing DNS response")
      source.request(65_537)
      if (source.buffer.size > 65_536) throw IOException("DNS response is too large")
      return parse(hostname, source.readUtf8())
    }
  }

  internal fun parse(hostname: String, body: String): DnsAnswer {
    try {
      val json = JSONObject(body)
      if (json.getInt("Status") != 0 || json.optBoolean("TC")) throw IOException("DNS query failed")
      val question = json.getJSONArray("Question")
      if (question.length() != 1 || question.getJSONObject(0).getString("name").trimEnd('.') != hostname ||
        question.getJSONObject(0).getInt("type") != 1) throw IOException("Unexpected DNS question")
      val records = json.getJSONArray("Answer")
      val addresses = mutableListOf<InetAddress>()
      var ttl = Long.MAX_VALUE
      for (index in 0 until records.length()) {
        val record = records.getJSONObject(index)
        // A CNAME can expire sooner than its final address.
        ttl = minOf(ttl, record.getLong("TTL").coerceAtLeast(0))
        if (record.getInt("type") != 1) continue
        val parts = record.getString("data").split('.')
        if (parts.size != 4 || parts.any { it.toIntOrNull() !in 0..255 }) throw IOException("Invalid DNS address")
        val octets = parts.map { it.toInt() }
        val address = InetAddress.getByAddress(hostname, octets.map { it.toByte() }.toByteArray())
        if (address.isAnyLocalAddress || address.isLoopbackAddress || address.isLinkLocalAddress ||
          address.isSiteLocalAddress || address.isMulticastAddress || octets[0] == 0 || octets[0] >= 240 ||
          (octets[0] == 100 && octets[1] in 64..127) || (octets[0] == 198 && octets[1] in 18..19)) {
          throw IOException("Non-public DNS address")
        }
        addresses.add(address)
      }
      if (addresses.isEmpty()) throw IOException("No IPv4 DNS answer")
      return DnsAnswer(addresses.distinct(), ttl)
    } catch (failure: JSONException) {
      throw IOException("Invalid DNS response", failure)
    }
  }
}
