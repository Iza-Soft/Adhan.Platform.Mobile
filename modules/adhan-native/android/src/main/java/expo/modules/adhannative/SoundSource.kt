package expo.modules.adhannative

import android.content.Context
import android.media.AudioAttributes
import android.media.MediaMetadataRetriever
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.net.Uri
import android.util.Log
import java.io.File

/**
 * Откъде да се вземе звукът (етап 6):
 * - вграден – името в res/raw без разширение („adhan_makkah“);
 * - свой – файл в паметта на приложението („file:///data/…/sounds/custom_17.mp3“).
 * Ако своят файл липсва (изтрит), се ползва вграденият резервен, а накрая – сигналът
 * за аларма на телефона.
 */
object SoundSource {
  private const val TAG = "AdhanSound"
  const val FALLBACK = "adhan_makkah"

  private fun isFile(source: String) = source.startsWith("file://") || source.startsWith("/")

  private fun fileOf(source: String): File = File(if (source.startsWith("file://")) Uri.parse(source).path ?: "" else source)

  /** Задава източника на плейъра. true – вграден или свой звук; false – сигналът на телефона. */
  fun setDataSource(context: Context, player: MediaPlayer, source: String): Boolean {
    if (source == "system") {
      // звукът за известия, избран в настройките на телефона
      player.setDataSource(context, android.provider.Settings.System.DEFAULT_NOTIFICATION_URI)
      return true
    }
    if (source.startsWith("content://")) {
      return try {
        player.setDataSource(context, Uri.parse(source))
        true
      } catch (e: Exception) {
        Log.w(TAG, "missing $source")
        setDataSource(context, player, FALLBACK)
      }
    }
    if (isFile(source)) {
      val f = fileOf(source)
      if (f.exists() && f.length() > 0) {
        player.setDataSource(f.absolutePath)
        return true
      }
      Log.w(TAG, "missing $source")
      return setDataSource(context, player, FALLBACK)
    }
    val resId = context.resources.getIdentifier(source, "raw", context.packageName)
    if (resId != 0) {
      val afd = context.resources.openRawResourceFd(resId)
      player.setDataSource(afd.fileDescriptor, afd.startOffset, afd.length)
      afd.close()
      return true
    }
    if (source != FALLBACK) return setDataSource(context, player, FALLBACK)
    player.setDataSource(context, RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM))
    return false
  }

  /** Дължината на звуков файл в секунди (mp3, m4a, mp4, wav, ogg, flac…). −1 – не става. */
  fun durationSec(context: Context, uri: String): Double {
    val r = MediaMetadataRetriever()
    return try {
      if (isFile(uri)) r.setDataSource(fileOf(uri).absolutePath) else r.setDataSource(context, Uri.parse(uri))
      val ms = r.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)?.toLongOrNull() ?: -1L
      val hasAudio = r.extractMetadata(MediaMetadataRetriever.METADATA_KEY_HAS_AUDIO)
      if (hasAudio != null && hasAudio != "yes") -1.0 else if (ms > 0) ms / 1000.0 else -1.0
    } catch (e: Exception) {
      Log.w(TAG, "duration: ${e.message}")
      -1.0
    } finally {
      try {
        r.release()
      } catch (e: Exception) {
        // нищо
      }
    }
  }
}

/** Преслушване в настройките – през потока за медия (силата на звука за музика). */
object SoundPreview {
  private var player: MediaPlayer? = null

  @Synchronized
  fun play(context: Context, source: String) {
    stop()
    val p = MediaPlayer()
    try {
      p.setAudioAttributes(
        AudioAttributes.Builder()
          .setUsage(AudioAttributes.USAGE_MEDIA)
          .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
          .build(),
      )
      SoundSource.setDataSource(context, p, source)
      p.setOnCompletionListener { stop() }
      p.prepare()
      p.start()
      player = p
    } catch (e: Exception) {
      Log.w("AdhanSound", "preview: ${e.message}")
      p.release()
    }
  }

  @Synchronized
  fun stop() {
    player?.let {
      try {
        it.stop()
      } catch (e: Exception) {
        // нищо
      }
      it.release()
    }
    player = null
  }
}
