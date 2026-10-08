package expo.modules.hayyanative

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.ContentValues
import android.content.Context
import android.media.AudioAttributes
import android.media.MediaCodec
import android.media.MediaExtractor
import android.media.MediaFormat
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import java.io.File
import java.io.OutputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder
import kotlin.math.abs
import kotlin.math.sqrt

/**
 * Свой кратък звук на Android (етап 6): откъс до 30 сек. от каквото избере потребителят.
 *
 * Краткият звук свири като звук на известие (когато „Alarms & reminders“ е изключено),
 * а системата за известия не чете файлове от паметта на приложението. Затова откъсът
 * се записва в общата папка Notifications/Ezan (Android 10+, без разрешения) и каналът
 * на известието сочи към него.
 *
 * Правилото за среза е същото като при вградените езани и на iPhone: тишината в началото
 * се маха, срез на последната истинска пауза между 15-ата и 30-ата сек., плавно заглъхване.
 */
object ShortSound {
  /** Колко от записа се чете най-много (тишина/въведение в началото + 30 сек.). */
  private const val READ_EXTRA_SEC = 60.0

  class Result(val uri: String, val duration: Double, val originalDuration: Double, val trimmed: Boolean)

  fun prepare(context: Context, source: String, title: String, maxSec: Double): Result {
    val pcm = decode(context, Uri.parse(source), maxSec + READ_EXTRA_SEC)
    val rate = pcm.rate
    val start = leadingSilence(pcm.samples, pcm.count, rate)
    val samples = pcm.samples.copyOfRange(start, pcm.count)
    val (end, fade) = cutPoint(samples, rate, maxSec)
    fadeOut(samples, end, fade)
    val wav = wavBytes(samples, end, rate)

    val original = if (pcm.totalSec > 0) pcm.totalSec else pcm.count.toDouble() / rate
    val playable = original - start.toDouble() / rate
    val uri = save(context, wav, title)
    return Result(uri, end.toDouble() / rate, original, playable > maxSec + 0.25)
  }

  /** Маха откъса (content:// от MediaStore или файл). */
  fun delete(context: Context, uri: String) {
    try {
      if (uri.startsWith("content://")) {
        context.contentResolver.delete(Uri.parse(uri), null, null)
      } else {
        File(Uri.parse(uri).path ?: uri).delete()
      }
    } catch (e: Exception) {
      // вече го няма
    }
  }

  /**
   * Канал за известие със свой звук (expo-notifications приема само звуци от res/raw).
   * alarm – езанът като известие: потокът за аларми и най-висока важност.
   */
  fun createChannel(
    context: Context,
    id: String,
    name: String,
    uri: String,
    alarm: Boolean,
    vibrate: Boolean,
    pattern: LongArray?,
  ) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    val channel = NotificationChannel(
      id,
      name,
      if (alarm) NotificationManager.IMPORTANCE_HIGH else NotificationManager.IMPORTANCE_DEFAULT,
    )
    val attrs = AudioAttributes.Builder()
      .setUsage(if (alarm) AudioAttributes.USAGE_ALARM else AudioAttributes.USAGE_NOTIFICATION)
      .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
      .build()
    // файл от паметта на приложението системата не може да чете – тогава звукът по подразбиране
    val sound = when {
      uri == "system" -> android.provider.Settings.System.DEFAULT_NOTIFICATION_URI
      uri.startsWith("content://") -> Uri.parse(uri)
      else -> null
    }
    channel.setSound(sound, attrs)
    channel.enableVibration(vibrate)
    if (vibrate && pattern != null) channel.vibrationPattern = pattern
    channel.lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
    nm.createNotificationChannel(channel)
  }

  /* ------------------------------------------------------------------ четене */

  private class Pcm(val samples: ShortArray, val count: Int, val rate: Int, val totalSec: Double)

  /** Всеки звук (mp3, m4a, mp4, wav, ogg, flac) → 16-битови семпли, моно, честотата на източника. */
  private fun decode(context: Context, uri: Uri, maxSec: Double): Pcm {
    val extractor = MediaExtractor()
    try {
      extractor.setDataSource(context, uri, null)
      var track = -1
      var format: MediaFormat? = null
      for (i in 0 until extractor.trackCount) {
        val f = extractor.getTrackFormat(i)
        if ((f.getString(MediaFormat.KEY_MIME) ?: "").startsWith("audio/")) {
          track = i
          format = f
          break
        }
      }
      if (track < 0 || format == null) throw IllegalArgumentException("no audio")
      extractor.selectTrack(track)
      val totalSec =
        if (format.containsKey(MediaFormat.KEY_DURATION)) format.getLong(MediaFormat.KEY_DURATION) / 1_000_000.0 else -1.0
      var rate = format.getInteger(MediaFormat.KEY_SAMPLE_RATE)
      var channels = format.getInteger(MediaFormat.KEY_CHANNEL_COUNT).coerceAtLeast(1)

      val codec = MediaCodec.createDecoderByType(format.getString(MediaFormat.KEY_MIME)!!)
      codec.configure(format, null, null, 0)
      codec.start()
      var out = ShortArray((rate * (maxSec + 1)).toInt().coerceAtLeast(1024))
      var n = 0
      val info = MediaCodec.BufferInfo()
      var inputDone = false
      var done = false
      var idle = 0
      try {
        while (!done && idle < 500) {
          if (!inputDone) {
            val ii = codec.dequeueInputBuffer(10_000)
            if (ii >= 0) {
              val buf = codec.getInputBuffer(ii)!!
              val size = extractor.readSampleData(buf, 0)
              if (size < 0) {
                codec.queueInputBuffer(ii, 0, 0, 0, MediaCodec.BUFFER_FLAG_END_OF_STREAM)
                inputDone = true
              } else {
                codec.queueInputBuffer(ii, 0, size, extractor.sampleTime, 0)
                extractor.advance()
              }
            }
          }
          val oi = codec.dequeueOutputBuffer(info, 10_000)
          if (oi == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED) {
            val f = codec.outputFormat
            rate = f.getInteger(MediaFormat.KEY_SAMPLE_RATE)
            channels = f.getInteger(MediaFormat.KEY_CHANNEL_COUNT).coerceAtLeast(1)
          } else if (oi >= 0) {
            idle = 0
            val ob: ByteBuffer = codec.getOutputBuffer(oi)!!
            ob.position(info.offset)
            ob.limit(info.offset + info.size)
            val sb = ob.slice().order(ByteOrder.nativeOrder()).asShortBuffer()
            val frames = sb.remaining() / channels
            for (fr in 0 until frames) {
              var sum = 0
              for (c in 0 until channels) sum += sb.get().toInt()
              if (n >= out.size) out = out.copyOf(out.size * 2)
              out[n++] = (sum / channels).toShort()
            }
            codec.releaseOutputBuffer(oi, false)
            if ((info.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM) != 0 || n >= rate * maxSec) done = true
          } else if (inputDone) {
            idle++
          }
        }
      } finally {
        try {
          codec.stop()
        } catch (e: Exception) {
          // нищо
        }
        codec.release()
      }
      if (n == 0) throw IllegalArgumentException("no audio")
      return Pcm(out, n, rate, totalSec)
    } finally {
      extractor.release()
    }
  }

  /* ------------------------------------------------------------------ срез */

  /** Колко семпла тишина има в началото (под 3% от най-силното място), с 50 мс запас. */
  private fun leadingSilence(s: ShortArray, count: Int, rate: Int): Int {
    var peak = 0
    for (i in 0 until count) {
      val a = abs(s[i].toInt())
      if (a > peak) peak = a
    }
    if (peak == 0) return 0
    val threshold = maxOf(peak * 0.03, 200.0)
    val win = (rate / 50).coerceAtLeast(1)
    var i = 0
    while (i + win <= count) {
      if (rms(s, i, win) > threshold) return maxOf(0, i - (0.05 * rate).toInt())
      i += win
    }
    return 0
  }

  private fun rms(s: ShortArray, start: Int, win: Int): Double {
    var sum = 0.0
    val end = minOf(start + win, s.size)
    for (k in start until end) {
      val v = s[k].toDouble()
      sum += v * v
    }
    return sqrt(sum / win)
  }

  /**
   * Докъде да свири и колко семпла да заглъхва. До maxSec – целият звук.
   * По-дълъг: последната истинска пауза (тихо поне 150 мс) между 15-ата секунда и края –
   * първо дълбоките (под 12% от средната сила), после по-меките (под 35%); срез в средата ѝ
   * с 0,5 сек. заглъхване. Без пауза – срез на maxSec с 3 сек. заглъхване.
   */
  private fun cutPoint(s: ShortArray, rate: Int, maxSec: Double): Pair<Int, Int> {
    val maxN = (maxSec * rate).toInt()
    if (s.size <= maxN) return Pair(s.size, minOf(s.size, (0.01 * rate).toInt()))
    val win = (rate / 10).coerceAtLeast(2)
    val levels = ArrayList<Double>()
    var i = 0
    while (i + win <= maxN) {
      levels.add(rms(s, i, win))
      i += win / 2
    }
    levels.sort()
    val median = if (levels.isEmpty()) 0.0 else levels[levels.size / 2]
    if (median <= 0) return Pair(maxN, 3 * rate)
    val to = maxN - win - win / 2
    var deep = -1
    var soft = -1
    var j = 15 * rate
    while (j <= to) {
      val level = maxOf(rms(s, j, win), rms(s, j + win / 2, win))
      if (level < 0.12 * median) {
        deep = j
      } else if (level < 0.35 * median) {
        soft = j
      }
      j += win / 2
    }
    val pick = if (deep >= 0) deep else soft
    if (pick >= 0) return Pair(pick + (3 * win) / 4, rate / 2)
    return Pair(maxN, 3 * rate)
  }

  private fun fadeOut(s: ShortArray, end: Int, length: Int) {
    val n = minOf(length, end)
    for (k in 0 until n) {
      val g = 1 - (k + 1).toDouble() / n
      val idx = end - n + k
      s[idx] = (s[idx] * g * g).toInt().toShort()
    }
  }

  /* ------------------------------------------------------------------ запис */

  private fun wavBytes(s: ShortArray, count: Int, rate: Int): ByteArray {
    val data = count * 2
    val b = ByteBuffer.allocate(44 + data).order(ByteOrder.LITTLE_ENDIAN)
    b.put("RIFF".toByteArray()).putInt(36 + data).put("WAVE".toByteArray())
    b.put("fmt ".toByteArray()).putInt(16).putShort(1).putShort(1).putInt(rate).putInt(rate * 2).putShort(2).putShort(16)
    b.put("data".toByteArray()).putInt(data)
    for (i in 0 until count) b.putShort(s[i])
    return b.array()
  }

  /** Android 10+: Notifications/Ezan (системата го чете); по-старите – паметта на приложението. */
  private fun save(context: Context, wav: ByteArray, title: String): String {
    val safe = title.replace(Regex("[\\\\/:*?\"<>|]"), " ").trim().take(60).ifEmpty { "Sound" }
    val fileName = "Ezan - $safe ${System.currentTimeMillis() % 100000}.wav"
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      val resolver = context.contentResolver
      val values = ContentValues().apply {
        put(MediaStore.Audio.Media.DISPLAY_NAME, fileName)
        put(MediaStore.Audio.Media.TITLE, "Ezan – $safe")
        put(MediaStore.Audio.Media.MIME_TYPE, "audio/x-wav")
        put(MediaStore.Audio.Media.RELATIVE_PATH, Environment.DIRECTORY_NOTIFICATIONS + "/Ezan")
        put(MediaStore.Audio.Media.IS_NOTIFICATION, 1)
        put(MediaStore.Audio.Media.IS_MUSIC, 0)
        put(MediaStore.Audio.Media.IS_PENDING, 1)
      }
      val collection = MediaStore.Audio.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY)
      val uri = resolver.insert(collection, values) ?: throw IllegalStateException("insert")
      try {
        val os: OutputStream = resolver.openOutputStream(uri) ?: throw IllegalStateException("open")
        os.use { it.write(wav) }
        values.clear()
        values.put(MediaStore.Audio.Media.IS_PENDING, 0)
        resolver.update(uri, values, null, null)
      } catch (e: Exception) {
        resolver.delete(uri, null, null)
        throw e
      }
      return uri.toString()
    }
    // Android 7–9: там „Alarms & reminders“ не съществува – винаги свири пълната аларма,
    // откъсът е само за преслушване
    val dir = File(context.filesDir, "sounds").apply { mkdirs() }
    val f = File(dir, "short_${System.currentTimeMillis()}.wav")
    f.writeBytes(wav)
    return Uri.fromFile(f).toString()
  }
}
