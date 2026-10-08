package expo.modules.hayyanative

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.graphics.drawable.Icon
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.media.MediaPlayer
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.os.VibrationAttributes
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.util.Log

/**
 * Езанът: foreground service, който пуска звука през потока за аларми
 * (звучи и при безшумен режим, както будилник), вибрира с пълна сила,
 * докато звучи, и показва известие със „Спри езана“ / „Заглуши“ и екрана „Аларма“.
 *
 * Състоянието е в companion обекта – екранът „Аларма“ (същия процес) го чете
 * няколко пъти в секунда за прогреса и вълната.
 */
class AlarmService : Service() {
  enum class State { IDLE, PLAYING, DONE }

  companion object {
    const val ACTION_START = "expo.modules.hayyanative.START"
    const val ACTION_STOP = "expo.modules.hayyanative.STOP"
    const val ACTION_MUTE = "expo.modules.hayyanative.MUTE"
    private const val CHANNEL_ID = "adhan-alarm"
    const val NOTIFICATION_ID = 7310
    private const val TAG = "HayyaAlarm"
    /** Предпазно: алармата спира най-много след 15 минути. */
    private const val MAX_PLAY_MS = 15 * 60 * 1000L

    @Volatile var current: AlarmData? = null
      private set
    @Volatile var state: State = State.IDLE
      private set
    @Volatile private var player: MediaPlayer? = null

    /** Позиция и дължина на звука в мс (за прогреса на екрана). */
    fun progress(): Pair<Int, Int> {
      val p = player ?: return Pair(0, 0)
      return try {
        Pair(p.currentPosition, p.duration)
      } catch (e: Exception) {
        Pair(0, 0)
      }
    }

    @Volatile var lastDuration: Int = 0
      private set

    fun command(context: Context, action: String) {
      val intent = Intent(context, AlarmService::class.java).setAction(action)
      try {
        context.startService(intent)
      } catch (e: Exception) {
        // услугата вече не работи (напр. след „Заглуши“) – само чистим известието
        if (action == ACTION_STOP) {
          (context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).cancel(NOTIFICATION_ID)
          current = null
          state = State.IDLE
        }
      }
    }
  }

  private val handler = Handler(Looper.getMainLooper())
  private var vibrator: Vibrator? = null
  private var focusRequest: AudioFocusRequest? = null
  private val timeout = Runnable { finishPlaying() }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    when (intent?.action) {
      ACTION_START -> {
        val alarm = AlarmData.fromJson(intent.getStringExtra(AlarmScheduler.EXTRA_ALARM))
        if (alarm == null) {
          // стартирана е с startForegroundService – Android иска startForeground и тук
          abortStart()
        } else {
          start(alarm)
        }
      }
      ACTION_MUTE -> finishPlaying()
      ACTION_STOP -> stopAll()
      else -> if (state != State.PLAYING) stopSelf()
    }
    return START_NOT_STICKY
  }

  /* ------------------------------------------------------------------ старт */

  private fun start(alarm: AlarmData) {
    // ако още звучи предишната аларма – спира я
    releaseSound()
    current = alarm
    state = State.PLAYING

    val notification = buildNotification(alarm, playing = true)
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK)
      } else {
        startForeground(NOTIFICATION_ID, notification)
      }
    } catch (e: Exception) {
      Log.w(TAG, "startForeground: ${e.message}")
    }

    AlarmScheduler.recordFired(this, alarm)
    handler.removeCallbacks(timeout)
    handler.postDelayed(timeout, MAX_PLAY_MS)
    playSound(alarm) // ако звукът не тръгне, тук срокът става 30 сек.
    if (alarm.vibrate) startVibration()
    AlarmReceiver.releaseWakeLock()
  }

  private fun playSound(alarm: AlarmData) {
    val attrs = AudioAttributes.Builder()
      .setUsage(AudioAttributes.USAGE_ALARM)
      .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
      .build()
    requestFocus(attrs)
    val p = MediaPlayer()
    try {
      p.setAudioAttributes(attrs)
      // вграден (res/raw) или свой файл; ако липсва – резервният, накрая сигналът на телефона
      SoundSource.setDataSource(this, p, alarm.sound)
      p.setWakeMode(this, PowerManager.PARTIAL_WAKE_LOCK)
      p.setOnCompletionListener { finishPlaying() }
      p.setOnErrorListener { _, _, _ ->
        finishPlaying()
        true
      }
      p.prepare()
      lastDuration = p.duration
      p.start()
      player = p
    } catch (e: Exception) {
      Log.w(TAG, "play: ${e.message}")
      p.release()
      // без звук – поне вибрацията и екранът; спира след 30 сек.
      handler.removeCallbacks(timeout)
      handler.postDelayed(timeout, 30_000)
    }
  }

  private fun requestFocus(attrs: AudioAttributes) {
    val am = getSystemService(Context.AUDIO_SERVICE) as AudioManager
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val req = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)
        .setAudioAttributes(attrs)
        .build()
      focusRequest = req
      am.requestAudioFocus(req)
    } else {
      @Suppress("DEPRECATION")
      am.requestAudioFocus(null, AudioManager.STREAM_ALARM, AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)
    }
  }

  private fun abandonFocus() {
    val am = getSystemService(Context.AUDIO_SERVICE) as AudioManager
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      focusRequest?.let { am.abandonAudioFocusRequest(it) }
      focusRequest = null
    } else {
      @Suppress("DEPRECATION")
      am.abandonAudioFocus(null)
    }
  }

  private fun abortStart() {
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (nm.getNotificationChannel(CHANNEL_ID) == null) {
          nm.createNotificationChannel(NotificationChannel(CHANNEL_ID, "Adhan", NotificationManager.IMPORTANCE_LOW))
        }
        val n = Notification.Builder(this, CHANNEL_ID).setSmallIcon(smallIcon()).build()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
          startForeground(NOTIFICATION_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK)
        } else {
          startForeground(NOTIFICATION_ID, n)
        }
        stopForeground(STOP_FOREGROUND_REMOVE)
      }
    } catch (e: Exception) {
      Log.w(TAG, "abort: ${e.message}")
    }
    AlarmReceiver.releaseWakeLock()
    stopSelf()
  }

  /* ------------------------------------------------------------------ вибрация */

  private fun startVibration() {
    val v: Vibrator? =
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        (getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager).defaultVibrator
      } else {
        @Suppress("DEPRECATION")
        getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
      }
    if (v == null || !v.hasVibrator()) return
    vibrator = v
    // 1 сек. вибрация / 0,7 сек. пауза, докато звучи езанът – с пълна сила (255)
    val timings = longArrayOf(0, 1000, 700)
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        val amplitudes = intArrayOf(0, 255, 0)
        val effect = VibrationEffect.createWaveform(timings, amplitudes, 1)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
          v.vibrate(effect, VibrationAttributes.createForUsage(VibrationAttributes.USAGE_ALARM))
        } else {
          val attrs = AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).build()
          @Suppress("DEPRECATION")
          v.vibrate(effect, attrs)
        }
      } else {
        @Suppress("DEPRECATION")
        v.vibrate(timings, 1)
      }
    } catch (e: Exception) {
      Log.w(TAG, "vibrate: ${e.message}")
    }
  }

  private fun stopVibration() {
    try {
      vibrator?.cancel()
    } catch (e: Exception) {
      // нищо
    }
    vibrator = null
  }

  /* ------------------------------------------------------------------ край */

  private fun releaseSound() {
    handler.removeCallbacks(timeout)
    player?.let {
      try {
        it.stop()
      } catch (e: Exception) {
        // нищо
      }
      it.release()
    }
    player = null
    stopVibration()
    abandonFocus()
  }

  /**
   * „Заглуши“ или езанът е свършил: тихо, без вибрация; известието остава
   * (вече може да се махне), екранът показва „Затвори“.
   */
  private fun finishPlaying() {
    releaseSound()
    val alarm = current
    if (alarm == null) {
      stopAll()
      return
    }
    state = State.DONE
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
      stopForeground(STOP_FOREGROUND_DETACH)
    } else {
      @Suppress("DEPRECATION")
      stopForeground(false)
    }
    val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    nm.notify(NOTIFICATION_ID, buildNotification(alarm, playing = false))
    stopSelf()
  }

  /** „Спри езана“ / „Затвори“: всичко спира, известието и екранът изчезват. */
  private fun stopAll() {
    releaseSound()
    current = null
    state = State.IDLE
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
      stopForeground(STOP_FOREGROUND_REMOVE)
    } else {
      @Suppress("DEPRECATION")
      stopForeground(true)
    }
    (getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).cancel(NOTIFICATION_ID)
    stopSelf()
  }

  override fun onDestroy() {
    if (state == State.PLAYING) releaseSound()
    super.onDestroy()
  }

  /* ------------------------------------------------------------------ известие */

  private fun ensureChannel(alarm: AlarmData) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    // звукът и вибрацията са от услугата, не от канала
    val channel = NotificationChannel(CHANNEL_ID, alarm.labels.channel, NotificationManager.IMPORTANCE_HIGH)
    channel.setSound(null, null)
    channel.enableVibration(false)
    channel.lockscreenVisibility = Notification.VISIBILITY_PUBLIC
    nm.createNotificationChannel(channel)
  }

  private fun buildNotification(alarm: AlarmData, playing: Boolean): Notification {
    ensureChannel(alarm)
    val screen = Intent(this, AlarmActivity::class.java)
      .putExtra(AlarmScheduler.EXTRA_ALARM, alarm.json)
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_NO_USER_ACTION)
    val screenPi = PendingIntent.getActivity(
      this,
      1,
      screen,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
    val stopPi = servicePending(ACTION_STOP, 2)
    val mutePi = servicePending(ACTION_MUTE, 3)

    val builder =
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        Notification.Builder(this, CHANNEL_ID)
      } else {
        @Suppress("DEPRECATION")
        Notification.Builder(this).setPriority(Notification.PRIORITY_MAX)
      }
    builder
      .setSmallIcon(smallIcon())
      .setColor(0xFFD4A857.toInt())
      .setContentTitle(alarm.notifTitle)
      .setContentText(alarm.notifBody.lineSequence().firstOrNull() ?: "")
      .setStyle(Notification.BigTextStyle().bigText(alarm.notifBody))
      .setCategory(Notification.CATEGORY_ALARM)
      .setVisibility(Notification.VISIBILITY_PUBLIC)
      .setContentIntent(screenPi)
      .setShowWhen(true)
      .setWhen(alarm.at)

    if (playing) {
      builder
        .setOngoing(true)
        .setAutoCancel(false)
        // на заключен телефон – целият екран „Аларма“ (ако е разрешено от Android 14)
        .setFullScreenIntent(screenPi, true)
        .addAction(action(alarm.labels.stop, stopPi))
        .addAction(action(alarm.labels.muteShort, mutePi))
        .setDeleteIntent(stopPi)
    } else {
      builder
        .setOngoing(false)
        .setAutoCancel(true)
        .setDeleteIntent(stopPi)
    }
    return builder.build()
  }

  private fun action(label: String, pi: PendingIntent): Notification.Action =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
      Notification.Action.Builder(null as Icon?, label, pi).build()
    } else {
      @Suppress("DEPRECATION")
      Notification.Action.Builder(0, label, pi).build()
    }

  private fun servicePending(action: String, code: Int): PendingIntent =
    PendingIntent.getService(
      this,
      code,
      Intent(this, AlarmService::class.java).setAction(action),
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

  /** Иконата на известията от app.json (expo-notifications → notification_icon). */
  private fun smallIcon(): Int {
    val id = resources.getIdentifier("notification_icon", "drawable", packageName)
    return if (id != 0) id else applicationInfo.icon
  }
}
