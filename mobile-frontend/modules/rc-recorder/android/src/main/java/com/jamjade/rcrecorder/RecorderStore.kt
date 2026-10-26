package com.jamjade.rcrecorder

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.AtomicFile
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.IOException
import java.security.KeyStore
import java.security.MessageDigest
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey

internal class RecorderStore(private val context: Context, val ownerHash: String) {
  companion object {
    const val RECORD_LIMIT = 64L * 1024 * 1024
    const val OWNER_LIMIT = 256L * 1024 * 1024
    const val FREE_RESERVE = 64L * 1024 * 1024
    const val MAX_RECORDINGS = 100
    val channels = linkedMapOf("accelerometer" to 1, "gyroscope" to 4, "gravity" to 9,
      "linear_acceleration" to 10, "rotation_vector" to 11)
    fun hash(bytes: ByteArray) = MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it) }
    fun canonical(value: Any?): String = when (value) {
      is JSONObject -> value.keys().asSequence().toList().sorted().joinToString(",", "{", "}") { JSONObject.quote(it) + ":" + canonical(value.get(it)) }
      is JSONArray -> (0 until value.length()).joinToString(",", "[", "]") { canonical(value.get(it)) }
      null, JSONObject.NULL -> "null"
      is String -> JSONObject.quote(value)
      else -> value.toString()
    }
  }

  private val root = File(context.noBackupFilesDir, "rc-research-v2/$ownerHash").apply { mkdirs() }
  private val keyAlias = "jamjade_rc_v2_$ownerHash"
  private fun key(create: Boolean = false): SecretKey {
    val keys = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
    (keys.getKey(keyAlias, null) as? SecretKey)?.let { return it }
    if (!create || root.listFiles()?.isNotEmpty() == true) throw IOException("Recording key is unavailable")
    return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore").run {
      init(KeyGenParameterSpec.Builder(keyAlias, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
        .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
        .setKeySize(256).setUserAuthenticationRequired(false).build())
      generateKey()
    }
  }

  private fun directory(id: String): File {
    require(Regex("[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}").matches(id))
    return File(root, id)
  }
  private fun directories() = root.listFiles()?.filter { it.isDirectory }?.sortedByDescending { it.lastModified() } ?: emptyList()
  fun usedBytes(): Long = root.walkTopDown().filter { it.isFile }.sumOf { it.length() }
  fun recordingBytes(id: String): Long = directory(id).walkTopDown().filter { it.isFile }.sumOf { it.length() }
  // Reserve actually available space; do not depend on reclaiming another cache during capture.
  fun capacityAvailable() = usedBytes() < OWNER_LIMIT && android.os.StatFs(root.path).availableBytes > FREE_RESERVE

  fun create(id: String, manifest: JSONObject) {
    require(directories().size < MAX_RECORDINGS) { "Local recording limit reached. Delete unwanted recordings." }
    require(capacityAvailable()) { "Recording storage is full. Delete unwanted recordings." }
    key(true) // Never replace a missing key when recordings still exist.
    val dir = directory(id)
    check(!dir.exists() && dir.mkdir()) { "Recording could not be created" }
    writeManifest(id, manifest)
  }

  fun writeManifest(id: String, manifest: JSONObject) {
    writeDocument(File(directory(id), "manifest.rc2"), "$ownerHash/$id/manifest", manifest)
  }

  private fun writeDocument(file: File, aad: String, document: JSONObject) {
    val bytes = canonical(document).toByteArray(Charsets.UTF_8)
    require(bytes.size <= 1048576) { "Recording metadata limit reached" }
    val target = AtomicFile(file)
    val output = target.startWrite()
    try {
      // Write to AtomicFile's private replacement; plaintext exists only in memory.
      val secret = key()
      val magic = byteArrayOf(74, 74, 82, 67, 50, 10)
      val data = java.io.DataOutputStream(output)
      data.write(magic)
      var index = 0
      var offset = 0
      while (offset < bytes.size) {
        val cipher = javax.crypto.Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(javax.crypto.Cipher.ENCRYPT_MODE, secret)
        cipher.updateAAD("$aad/$index".toByteArray(Charsets.UTF_8))
        val end = minOf(bytes.size, offset + EncryptedFrames.MAX_PLAINTEXT)
        val encrypted = cipher.doFinal(bytes, offset, end - offset)
        data.writeInt(encrypted.size); data.write(cipher.iv); data.write(encrypted)
        index++; offset = end
      }
      data.flush()
      target.finishWrite(output)
    } catch (failure: Throwable) { target.failWrite(output); throw failure }
  }

  fun readManifest(id: String): JSONObject {
    return readDocument(File(directory(id), "manifest.rc2"), "$ownerHash/$id/manifest")
  }

  private fun readDocument(file: File, aad: String): JSONObject {
    val atomic = AtomicFile(file)
    atomic.openRead().close() // Restore AtomicFile's prior snapshot after an interrupted replace.
    return JSONObject(String(EncryptedFrames.readSmall(atomic.baseFile, key(), aad), Charsets.UTF_8))
  }

  private fun groupIndex(): JSONObject {
    val file = File(root, "groups.rc2")
    if (!file.exists() && !File(root, "groups.rc2.bak").exists())
      return JSONObject().put("format_version", 1).put("groups", JSONObject()).put("selected_group_id", JSONObject.NULL)
    val index = readDocument(file, "$ownerHash/groups")
    require(index.getInt("format_version") == 1 && index.getJSONObject("groups").length() <= 50)
    return index
  }

  private fun collectionGroups() = CollectionGroups(::groupIndex) { index ->
    key(true)
    writeDocument(File(root, "groups.rc2"), "$ownerHash/groups", index)
  }
  fun groups() = collectionGroups().catalog()
  fun createGroup(values: JSONObject, createdAt: String): JSONObject {
    check(capacityAvailable()) { "Recording storage is full" }
    return collectionGroups().create(values, createdAt)
  }
  fun group(id: String) = collectionGroups().group(id)
  fun allocateRecording(groupId: String) = collectionGroups().allocate(groupId)

  fun list(offset: Int, activeId: String?): JSONArray {
    require(offset in 0..MAX_RECORDINGS)
    val results = JSONArray()
    directories().drop(offset).take(10).forEach { dir ->
      val record = try { if (dir.name == activeId) readManifest(dir.name) else recover(dir.name) } catch (_: Exception) {
        JSONObject().put("recording_id", dir.name).put("state", "unavailable").put("end_reason", "key_or_file_unavailable")
      }
      results.put(summary(record))
    }
    return results
  }

  fun summary(record: JSONObject): JSONObject {
    val summary = JSONObject()
    listOf("recording_id", "state", "started_at_utc", "ended_at_utc", "duration_ms", "end_reason",
      "protocol_version", "source", "channels", "diagnostics_partial", "integrity", "annotation_state", "transfer_state", "phone_power", "device").forEach {
      summary.put(it, record.opt(it) ?: JSONObject.NULL)
    }
    summary.put("context", record.optJSONObject("context") ?: JSONObject())
    if (record.optString("state") != "unavailable" && record.optString("recording_id").matches(Regex("[0-9a-f-]{36}"))) {
      // A damaged transfer receipt must not hide otherwise readable originals.
      val transfer = try { transfer(record.getString("recording_id")) } catch (_: Exception) { JSONObject().put("state", "upload_failed") }
      summary.put("transfer_state", transfer.getString("state")).put("transfer", transfer)
    }
    return summary
  }

  fun transfer(id: String): JSONObject {
    val file = File(directory(id), "transfer.rc2")
    if (!file.exists() && !File(file.path + ".bak").exists()) return JSONObject().put("state", "local_only")
    return readDocument(file, "$ownerHash/$id/transfer")
  }

  fun setTransfer(id: String, value: JSONObject) {
    require(value.keys().asSequence().toSet().all { it in setOf("state", "server_id", "manifest_sha256") })
    require(value.getString("state") in setOf("uploading", "upload_failed", "uploaded"))
    if (value.getString("state") == "uploaded") {
      require(value.getString("server_id").matches(Regex("[0-9a-f-]{36}")))
      require(value.getString("manifest_sha256").matches(Regex("[0-9a-f]{64}")))
    }
    readManifest(id)
    writeDocument(File(directory(id), "transfer.rc2"), "$ownerHash/$id/transfer", value)
  }

  fun exportManifest(id: String): JSONObject {
    val record = recover(id)
    require(record.getString("state") in setOf("stopped", "interrupted")) { "Stop recording before uploading" }
    require(record.optString("integrity") in setOf("sealed", "verified_prefix")) { "Recording needs verified recovery before upload" }
    val json = canonical(record)
    return JSONObject().put("manifest_json", json).put("manifest_sha256", hash(json.toByteArray(Charsets.UTF_8)))
  }

  fun exportChunk(id: String, channel: String, index: Int): String {
    require(channel in channels && index in 0..9999)
    val manifest = recover(id)
    require(manifest.getString("state") in setOf("stopped", "interrupted"))
    val chunks = manifest.getJSONArray("chunks")
    val descriptor = (0 until chunks.length()).map { chunks.getJSONObject(it) }
      .single { it.getString("channel") == channel && it.getInt("chunk_index") == index }
    require(descriptor.getBoolean("sealed"))
    val bytes = VerifiedChunk.read(File(directory(id), "$channel-${index.toString().padStart(6, '0')}.rc2"), key(),
      "$ownerHash/$id/$channel/$index", descriptor.getLong("logical_bytes"), descriptor.getString("sha256"), descriptor.optBoolean("truncated_tail"))
    return String(bytes, Charsets.UTF_8)
  }

  fun recover(id: String): JSONObject {
    val manifest = readManifest(id)
    if (manifest.optString("state") !in listOf("recording", "preparing", "stopping")) return manifest
    val start = manifest.getString("started_elapsed_ns").toLong()
    val inventory = manifest.getJSONObject("channels")
    val chunks = JSONArray()
    val recoveredStats = linkedMapOf<String, ChannelStatistics>()
    var latest = start
    for (channel in channels.keys) {
      val stats = ChannelStatistics()
      var truncated = false
      val files = directory(id).listFiles()?.filter { Regex("${channel}-[0-9]{6}\\.rc2").matches(it.name) }?.sortedBy { it.name } ?: emptyList()
      files.forEach { file ->
        val digest = MessageDigest.getInstance("SHA-256")
        var count = 0L
        var first: JSONObject? = null
        var last: JSONObject? = null
        val index = file.name.removePrefix("$channel-").removeSuffix(".rc2").toInt()
        val result = EncryptedFrames.scan(file, key(), "$ownerHash/$id/$channel/$index") { bytes ->
          digest.update(bytes)
          String(bytes, Charsets.UTF_8).lineSequence().filter { it.isNotEmpty() }.forEach { line ->
            val event = JSONObject(line)
            val values = event.getJSONArray("values")
            val timestamp = event.getString("sensor_timestamp_ns").toLong()
            val received = event.getString("received_elapsed_ns").toLong()
            stats.observe(timestamp, received, FloatArray(values.length()) { values.getDouble(it).toFloat() }, event.getInt("accuracy"), start)
            stats.persisted++
            latest = maxOf(latest, received)
            if (first == null) first = event
            last = event; count++
          }
        }
        truncated = truncated || result.truncatedTail
        chunks.put(JSONObject().put("channel", channel).put("chunk_index", index).put("event_count", count)
          .put("logical_bytes", result.plaintextBytes).put("sha256", digest.digest().joinToString("") { "%02x".format(it) })
          .put("first_sequence", first?.optLong("sequence") ?: JSONObject.NULL).put("last_sequence", last?.optLong("sequence") ?: JSONObject.NULL)
          .put("first_sensor_timestamp_ns", first?.optString("sensor_timestamp_ns") ?: JSONObject.NULL)
          .put("last_sensor_timestamp_ns", last?.optString("sensor_timestamp_ns") ?: JSONObject.NULL)
          .put("truncated_tail", result.truncatedTail).put("sealed", true))
      }
      recoveredStats[channel] = stats
      inventory.optJSONObject(channel)?.put("truncated_tail", truncated)
    }
    recoveredStats.forEach { (channel, stats) -> inventory.optJSONObject(channel)?.put("statistics", statsJson(stats, start, latest, true)) }
    manifest.put("state", "interrupted").put("end_reason", "runtime_interrupted")
      .put("ended_elapsed_ns", latest.toString()).put("duration_ms", (latest - start).coerceAtLeast(0) / 1e6)
      .put("ended_at_utc", JSONObject.NULL).put("diagnostics_partial", true).put("integrity", "verified_prefix")
      .put("end_time_source", "last_verified_receipt")
      .put("chunks", chunks).put("chunk_inventory_sha256", hash(canonical(chunks).toByteArray(Charsets.UTF_8)))
    manifest.getJSONArray("lifecycle").put(JSONObject().put("state", "interrupted").put("reason", "runtime_interrupted")
      .put("last_verified_elapsed_ns", latest.toString()).put("ended_elapsed_ns", JSONObject.NULL))
    writeManifest(id, manifest)
    return manifest
  }

  fun delete(id: String) {
    val dir = directory(id)
    require(dir.exists()) { "Recording not found" }
    check(dir.deleteRecursively()) { "Recording could not be completely deleted" }
  }

  fun writer(id: String, channel: String, stats: ChannelStatistics) = ChannelWriter(id, channel, stats)

  inner class ChannelWriter(private val id: String, private val channel: String, private val stats: ChannelStatistics) {
    private var index = 0
    private var frame = 0
    private var buffer = ByteArrayOutputStream()
    private var pending = 0L
    private var count = 0L
    private var bytes = 0L
    private var chunkStart = 0L
    private var firstSequence: Long? = null
    private var lastSequence: Long? = null
    private var firstTimestamp: String? = null
    private var lastTimestamp: String? = null
    private var digest = MessageDigest.getInstance("SHA-256")
    val closed = JSONArray()

    fun append(event: JSONObject, now: Long) {
      val line = (event.toString() + "\n").toByteArray(Charsets.UTF_8)
      if (bytes + buffer.size() + line.size > 1048576 || (chunkStart != 0L && now - chunkStart >= 10000000000L)) seal()
      if (chunkStart == 0L) chunkStart = now
      if (buffer.size() + line.size > 32768) checkpoint()
      if (firstSequence == null) { firstSequence = event.getLong("sequence"); firstTimestamp = event.getString("sensor_timestamp_ns") }
      lastSequence = event.getLong("sequence"); lastTimestamp = event.getString("sensor_timestamp_ns")
      buffer.write(line); pending++
    }

    fun checkpoint() {
      if (buffer.size() == 0) return
      val plaintext = buffer.toByteArray()
      val file = File(directory(id), "$channel-${index.toString().padStart(6, '0')}.rc2")
      EncryptedFrames.append(file, key(), "$ownerHash/$id/$channel/$index", frame, plaintext)
      digest.update(plaintext); bytes += plaintext.size; count += pending; stats.persisted += pending
      frame++; buffer.reset(); pending = 0
    }

    private fun descriptor(sealed: Boolean, hash: String? = null) = JSONObject().put("channel", channel).put("chunk_index", index)
      .put("event_count", count).put("logical_bytes", bytes).put("sealed", sealed).put("sha256", hash ?: JSONObject.NULL)
      .put("first_sequence", firstSequence ?: JSONObject.NULL).put("last_sequence", lastSequence ?: JSONObject.NULL)
      .put("first_sensor_timestamp_ns", firstTimestamp ?: JSONObject.NULL).put("last_sensor_timestamp_ns", lastTimestamp ?: JSONObject.NULL)

    fun seal() {
      checkpoint()
      if (count == 0L) return
      closed.put(descriptor(true, digest.digest().joinToString("") { "%02x".format(it) }))
      index++; frame = 0; count = 0; bytes = 0; chunkStart = 0
      firstSequence = null; lastSequence = null; firstTimestamp = null; lastTimestamp = null
      digest = MessageDigest.getInstance("SHA-256")
    }

    fun descriptors(): List<JSONObject> = (0 until closed.length()).map { closed.getJSONObject(it) } +
      if (count > 0) listOf(descriptor(false)) else emptyList()
  }
}

internal fun statsJson(stats: ChannelStatistics, start: Long, end: Long, partial: Boolean = false) = JSONObject()
  .put("received_count", if (partial) JSONObject.NULL else stats.received).put("persisted_count", stats.persisted)
  .put("rejected_count", if (partial) JSONObject.NULL else stats.rejected)
  .put("not_durable_count", if (partial) JSONObject.NULL else stats.valid - stats.persisted)
  .put("duplicate_timestamps", stats.duplicates).put("backwards_timestamps", stats.backwards)
  .put("future_timestamps", stats.futureTimestamps).put("pre_start_count", stats.preStart).put("accuracy_changes", stats.accuracyChanges)
  .put("first_sensor_timestamp_ns", stats.firstNs?.toString() ?: JSONObject.NULL).put("last_sensor_timestamp_ns", stats.lastNs?.toString() ?: JSONObject.NULL)
  .put("rate_hz", stats.rateHz() ?: JSONObject.NULL).put("max_gap_ms", if (stats.valid > 1) stats.maxGapNs / 1e6 else JSONObject.NULL)
  .put("median_interval_ms_approx", stats.intervalQuantileMs(0.5) ?: JSONObject.NULL)
  .put("p95_interval_ms_approx", stats.intervalQuantileMs(0.95) ?: JSONObject.NULL).put("interval_bucket_ms", 1)
  .put("startup_gap_ms", stats.firstNs?.let { (it - start).coerceAtLeast(0) / 1e6 } ?: JSONObject.NULL)
  .put("trailing_gap_ms", stats.lastNs?.let { (end - it).coerceAtLeast(0) / 1e6 } ?: JSONObject.NULL)
  .put("max_receipt_delay_ms", if (stats.valid > 0) stats.maxReceiptDelayNs / 1e6 else JSONObject.NULL)
  .put("hardware_loss_count", JSONObject.NULL)
