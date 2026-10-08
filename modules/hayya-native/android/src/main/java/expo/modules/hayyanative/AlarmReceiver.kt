package expo.modules.hayyanative

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.PowerManager
import android.util.Log

/**
 * Часът на молитвата: пуска AlarmService (звук, вибрация, известие, екран „Аларма“).
 * За известията и напомнянията („notify“) – само показва известието (NotifyPoster).
 */
class AlarmReceiver : BroadcastReceiver() {
  companion object {
    private var wakeLock: PowerManager.WakeLock? = null

    /**
     * Будилникът държи телефона буден само докато върви onReceive. Докато услугата
     * тръгне и пусне звука, процесорът не бива да заспи – затова собствен wake lock
     * (най-много 60 сек.); услугата го пуска, щом звукът тръгне.
     */
    @Synchronized
    fun acquireWakeLock(context: Context) {
      if (wakeLock?.isHeld == true) return
      val pm = context.getSystemService(Context.POWER_SERVICE) as PowerManager
      wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "adhan:alarm").apply {
        setReferenceCounted(false)
        acquire(60_000L)
      }
    }

    @Synchronized
    fun releaseWakeLock() {
      try {
        wakeLock?.let { if (it.isHeld) it.release() }
      } catch (e: Exception) {
        // нищо
      }
      wakeLock = null
    }
  }

  override fun onReceive(context: Context, intent: Intent) {
    val json = intent.getStringExtra(AlarmScheduler.EXTRA_ALARM) ?: return
    val alarm = AlarmData.fromJson(json) ?: return
    // телефонът е бил изключен и алармата идва много по-късно – не звъни
    if (System.currentTimeMillis() - alarm.at > AlarmScheduler.MAX_LATE_MS) return
    // обикновено известие или напомняне – показва се веднага, без услуга и без екран „Аларма“
    if (alarm.mode == "notify") {
      NotifyPoster.post(context, alarm)
      AlarmScheduler.recordFired(context, alarm)
      return
    }
    acquireWakeLock(context)

    val service = Intent(context, AlarmService::class.java)
      .setAction(AlarmService.ACTION_START)
      .putExtra(AlarmScheduler.EXTRA_ALARM, json)
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        context.startForegroundService(service)
      } else {
        context.startService(service)
      }
    } catch (e: Exception) {
      Log.w("HayyaAlarm", "start service: ${e.message}")
      releaseWakeLock()
    }
  }
}

/** След рестарт, обновяване на приложението или смяна на часа – алармите се планират наново. */
class BootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    try {
      AlarmScheduler.rescheduleAll(context)
    } catch (e: Exception) {
      Log.w("HayyaAlarm", "reschedule: ${e.message}")
    }
    // widget-ите (етап 8): след рестарт/смяна на часа Chronometer-ът трябва нова основа
    try {
      PrayerWidgets.updateAll(context)
    } catch (e: Exception) {
      Log.w("HayyaWidget", "boot: ${e.message}")
    }
  }
}
