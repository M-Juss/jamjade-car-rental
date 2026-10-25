package com.jamjade.rcrecorder

import java.io.ByteArrayOutputStream
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.io.RandomAccessFile
import javax.crypto.Cipher
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/** Each frame authenticates independently, so an interrupted tail cannot invalidate prior frames. */
internal object EncryptedFrames {
  private val magic = byteArrayOf(74, 74, 82, 67, 50, 10)
  const val MAX_PLAINTEXT = 65536
  private const val IV_BYTES = 12
  private const val TAG_BYTES = 16

  data class Scan(val frames: Int, val plaintextBytes: Long, val truncatedTail: Boolean)

  fun append(file: File, key: SecretKey, aad: String, frame: Int, plaintext: ByteArray) {
    require(plaintext.isNotEmpty() && plaintext.size <= MAX_PLAINTEXT)
    val cipher = Cipher.getInstance("AES/GCM/NoPadding")
    cipher.init(Cipher.ENCRYPT_MODE, key)
    require(cipher.iv.size == IV_BYTES)
    cipher.updateAAD("$aad/$frame".toByteArray(Charsets.UTF_8))
    val encrypted = cipher.doFinal(plaintext)
    val isNew = !file.exists()
    require(isNew == (frame == 0)) { "Invalid encrypted frame sequence" }
    FileOutputStream(file, true).use { stream ->
      val output = java.io.DataOutputStream(stream)
      if (isNew) output.write(magic)
      output.writeInt(encrypted.size)
      output.write(cipher.iv)
      output.write(encrypted)
      output.flush()
      stream.fd.sync()
    }
  }

  fun scan(file: File, key: SecretKey, aad: String, consume: (ByteArray) -> Unit): Scan {
    var frames = 0
    var bytes = 0L
    RandomAccessFile(file, "r").use { input ->
      if (input.length() < magic.size) return Scan(0, 0, true)
      val header = ByteArray(magic.size)
      input.readFully(header)
      if (!header.contentEquals(magic)) throw IOException("Invalid encrypted recording")
      while (input.filePointer < input.length()) {
        if (input.length() - input.filePointer < 4) return Scan(frames, bytes, true)
        val length = input.readInt()
        if (length < TAG_BYTES + 1 || length > MAX_PLAINTEXT + TAG_BYTES) throw IOException("Invalid frame length")
        if (input.length() - input.filePointer < IV_BYTES + length) return Scan(frames, bytes, true)
        val iv = ByteArray(IV_BYTES)
        input.readFully(iv)
        val encrypted = ByteArray(length)
        input.readFully(encrypted)
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.DECRYPT_MODE, key, GCMParameterSpec(128, iv))
        cipher.updateAAD("$aad/$frames".toByteArray(Charsets.UTF_8))
        val plaintext = try { cipher.doFinal(encrypted) } catch (failure: Exception) {
          throw IOException("Recording authentication failed", failure)
        }
        consume(plaintext)
        bytes += plaintext.size
        frames++
      }
    }
    return Scan(frames, bytes, false)
  }

  fun readSmall(file: File, key: SecretKey, aad: String): ByteArray {
    val output = ByteArrayOutputStream()
    val scan = scan(file, key, aad) {
      if (output.size() + it.size > 1048576) throw IOException("Manifest too large")
      output.write(it)
    }
    if (scan.truncatedTail || scan.frames < 1) throw IOException("Incomplete manifest")
    return output.toByteArray()
  }
}
