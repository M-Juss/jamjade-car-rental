package com.jamjade.rcrecorder

import org.junit.Assert.*
import org.junit.Test
import java.io.File
import java.io.RandomAccessFile
import java.security.MessageDigest
import javax.crypto.spec.SecretKeySpec

class VerifiedChunkTest {
  private val key = SecretKeySpec(ByteArray(32) { (it + 1).toByte() }, "AES")
  private val bytes = "{\"synthetic\":true,\"sensor_timestamp_ns\":\"9007199254740993\"}\n".toByteArray()
  private fun hash() = MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it) }
  private fun file() = File.createTempFile("rc-upload-", ".test").apply { delete(); deleteOnExit(); EncryptedFrames.append(this, key, "fixture", 0, bytes) }

  @Test fun exportsExactVerifiedBytesWithoutRewritingEncryptedOriginal() {
    val file = file()
    val original = file.readBytes()
    assertArrayEquals(bytes, VerifiedChunk.read(file, key, "fixture", bytes.size.toLong(), hash(), false))
    assertArrayEquals(original, file.readBytes())
  }
  @Test(expected = IllegalArgumentException::class) fun rejectsDifferentManifestHash() {
    VerifiedChunk.read(file(), key, "fixture", bytes.size.toLong(), "0".repeat(64), false)
  }
  @Test fun exportsOnlyAnExplicitlyRecoveredAuthenticatedPrefix() {
    val file = file()
    EncryptedFrames.append(file, key, "fixture", 1, "partial\n".toByteArray())
    RandomAccessFile(file, "rw").use { it.setLength(it.length() - 3) }
    try { VerifiedChunk.read(file, key, "fixture", bytes.size.toLong(), hash(), false); fail("Unreported tail accepted") } catch (_: IllegalArgumentException) {}
    assertArrayEquals(bytes, VerifiedChunk.read(file, key, "fixture", bytes.size.toLong(), hash(), true))
  }
}
