package com.jamjade.network

import java.io.IOException
import okhttp3.OkHttpClient
import okhttp3.Protocol
import okhttp3.Response
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.Assert.*
import org.junit.Test

class GoogleDnsLookupTest {
  private val host = "api.example.com"
  private fun body(address: String = "8.8.8.8", ttl: Long = 60) =
    """{"Status":0,"Question":[{"name":"$host.","type":1}],"Answer":[{"name":"$host.","type":1,"TTL":$ttl,"data":"$address"}]}"""

  @Test fun encryptedLookupSendsOnlyDnsParametersAndNoApplicationCredentials() {
    var checked = false
    val client = OkHttpClient.Builder().addInterceptor { chain ->
      val request = chain.request()
      assertEquals("https", request.url.scheme)
      assertEquals("dns.google", request.url.host)
      assertEquals("/resolve", request.url.encodedPath)
      assertEquals(host, request.url.queryParameter("name"))
      assertEquals("A", request.url.queryParameter("type"))
      assertEquals("0.0.0.0/0", request.url.queryParameter("edns_client_subnet"))
      assertNull(request.header("Authorization"))
      assertNull(request.header("Cookie"))
      assertNull(request.body)
      checked = true
      Response.Builder().request(request).protocol(Protocol.HTTP_1_1).code(200).message("OK")
        .body(body().toResponseBody()).build()
    }.build()
    val result = GoogleDnsLookup(client).resolve(host)
    assertTrue(checked)
    assertEquals("8.8.8.8", result.addresses.single().hostAddress)
    assertEquals(60L, result.ttlSeconds)
  }

  @Test fun rejectsPrivateMalformedOrAbsentAddresses() {
    val lookup = GoogleDnsLookup()
    for (ip in listOf("127.0.0.1", "10.0.0.1", "192.168.1.1", "169.254.1.1", "0.0.0.0", "224.0.0.1", "100.64.0.1", "999.0.0.1", "other.example.com")) {
      assertThrows(IOException::class.java) { lookup.parse(host, body(ip)) }
    }
    for (invalid in listOf("{}", "not json", body().replace("\"Status\":0", "\"Status\":3"), body().replace(host, "unrelated.example.com"))) {
      assertThrows(IOException::class.java) { lookup.parse(host, invalid) }
    }
  }

  @Test fun respectsEarlierCnameExpiry() {
    val response = body().replace("\"Answer\":[", "\"Answer\":[{\"name\":\"$host.\",\"type\":5,\"TTL\":5,\"data\":\"edge.example.com.\"},")
    assertEquals(5L, GoogleDnsLookup().parse(host, response).ttlSeconds)
  }

  @Test fun rejectsHttpErrorsAndOversizedResponses() {
    for ((code, responseBody) in listOf(503 to "unavailable", 200 to " ".repeat(65_537))) {
      val client = OkHttpClient.Builder().addInterceptor { chain ->
        Response.Builder().request(chain.request()).protocol(Protocol.HTTP_1_1).code(code).message("Test")
          .body(responseBody.toResponseBody()).build()
      }.build()
      assertThrows(IOException::class.java) { GoogleDnsLookup(client).resolve(host) }
    }
  }
}
