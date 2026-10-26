package com.jamjade.rcrecorder

import java.io.ByteArrayOutputStream
import java.io.File
import java.security.MessageDigest
import javax.crypto.SecretKey

internal object VerifiedChunk {
  fun read(file: File, key: SecretKey, aad: String, expectedBytes: Long, sha256: String, recoveredTail: Boolean): ByteArray {
    require(expectedBytes in 1..1048576)
    val output = ByteArrayOutputStream()
    val scan = EncryptedFrames.scan(file, key, aad) {
      require(output.size() + it.size <= 1048576) { "Chunk exceeds upload limit" }
      output.write(it)
    }
    require(!scan.truncatedTail || recoveredTail) { "Unexpected incomplete chunk" }
    val bytes = output.toByteArray()
    val hash = MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it) }
    require(bytes.size.toLong() == expectedBytes && hash == sha256) { "Recording chunk could not be verified" }
    return bytes
  }
}
