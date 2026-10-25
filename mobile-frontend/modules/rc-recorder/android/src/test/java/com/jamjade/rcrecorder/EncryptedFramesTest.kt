package com.jamjade.rcrecorder

import org.junit.Assert.*
import org.junit.Test
import java.io.File
import java.io.IOException
import java.io.RandomAccessFile
import javax.crypto.spec.SecretKeySpec

class EncryptedFramesTest {
  private val key = SecretKeySpec(ByteArray(32) { (it + 1).toByte() }, "AES") // Synthetic test key, never used by the app.
  private fun file() = File.createTempFile("rc-frames-", ".test").apply { delete(); deleteOnExit() }

  @Test fun encryptsAndAuthenticatesOriginalBytes() {
    val file = file()
    val original = "{\"sensor_timestamp_ns\":\"9007199254740993\",\"values\":[1,2,3]}\n".toByteArray()
    EncryptedFrames.append(file, key, "synthetic-owner/recording/channel/0", 0, original)
    assertFalse(String(file.readBytes()).contains("sensor_timestamp_ns"))
    assertArrayEquals(original, EncryptedFrames.readSmall(file, key, "synthetic-owner/recording/channel/0"))
  }

  @Test fun recoversCompleteFramesWhenLastFrameIsTruncated() {
    val file = file()
    EncryptedFrames.append(file, key, "fixture", 0, "first\n".toByteArray())
    EncryptedFrames.append(file, key, "fixture", 1, "second\n".toByteArray())
    RandomAccessFile(file, "rw").use { it.setLength(it.length() - 4) }
    val recovered = mutableListOf<String>()
    val result = EncryptedFrames.scan(file, key, "fixture") { recovered.add(String(it)) }
    assertEquals(listOf("first\n"), recovered)
    assertEquals(1, result.frames)
    assertTrue(result.truncatedTail)
    assertEquals(6L, result.plaintextBytes)
  }

  @Test(expected = IOException::class) fun rejectsModifiedCiphertext() {
    val file = file()
    EncryptedFrames.append(file, key, "fixture", 0, "original\n".toByteArray())
    RandomAccessFile(file, "rw").use { it.seek(it.length() - 1); val value = it.readByte(); it.seek(it.length() - 1); it.writeByte(value.toInt() xor 1) }
    EncryptedFrames.scan(file, key, "fixture") { fail("Unauthenticated data returned") }
  }

  @Test(expected = IOException::class) fun rejectsCrossOwnerOrChunkReplay() {
    val file = file()
    EncryptedFrames.append(file, key, "owner-a/recording/accelerometer/0", 0, "original\n".toByteArray())
    EncryptedFrames.scan(file, key, "owner-b/recording/accelerometer/0") { fail("Cross-owner frame returned") }
  }

  @Test(expected = IllegalArgumentException::class) fun rejectsUnboundedFrames() {
    EncryptedFrames.append(file(), key, "fixture", 0, ByteArray(EncryptedFrames.MAX_PLAINTEXT + 1))
  }

  @Test(expected = IOException::class) fun rejectsUnboundedFrameLengthBeforeAllocating() {
    val file = file()
    EncryptedFrames.append(file, key, "fixture", 0, "original\n".toByteArray())
    RandomAccessFile(file, "rw").use { it.seek(6); it.writeInt(Int.MAX_VALUE) }
    EncryptedFrames.scan(file, key, "fixture") { fail("Malformed frame returned") }
  }
}
