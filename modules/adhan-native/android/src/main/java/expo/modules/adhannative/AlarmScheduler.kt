package expo.modules.adhannative

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.util.Log
import org.json.JSONArray
import org.json.JSONObject

/**
 * Планиране на алармите с AlarmManager.setAlarmClock – като будилника на телефона:
 * звъни точно, събужда телефона и минава през режима за пестене на батерия (Doze).
 *
 * Списъкът се пази в SharedPreferences, за да може след рестарт на телефона
 * (BootReceiver) алармите да се планират наново без приложението.
 */
object AlarmScheduler {
  private const val TAG = "AdhanAlarm"
  private const val PREFS = "adhan_alarms"
  private const val KEY_LIST = "list"
  private const val KEY_SCHEDULED = "scheduled"
  private const val KEY_HISTORY = "history"
  const val EXTRA_ALARM = "expo.modules.adhannative.ALARM"
  const val TEST_ID = "test"

  /** Аларма, по-стара от това (телефонът е бил изключен), не звъни. */
  const val MAX_LATE_MS = 10 * 60 * 1000L

  private fun prefs(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  private fun alarmManager(context: Context) = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager

  fun canScheduleExact(context: Context): Boolean =
    Build.VERSION.SDK_INT < Build.VERSION_CODES.S || alarmManager(context).canScheduleExactAlarms()

  /**
   * Заменя всички аларми с новия списък (JSON масив). Отменя старите, планира бъдещите.
   * Връща колко са планирани.
   */
  fun setAlarms(context: Context, json: String): Int {
    val alarms = AlarmData.listFromJson(json)
    prefs(context).edit().putString(KEY_LIST, json).apply()
    return scheduleAll(context, alarms)
  }

  /** След рестарт, обновяване или смяна на часа – наново от запазения списък. */
  fun rescheduleAll(context: Context): Int =
    scheduleAll(context, AlarmData.listFromJson(prefs(context).getString(KEY_LIST, null)))

  fun storedJson(context: Context): String = prefs(context).getString(KEY_LIST, null) ?: "[]"

  private fun scheduleAll(context: Context, alarms: List<AlarmData>): Int {
    val previous = prefs(context).getStringSet(KEY_SCHEDULED, emptySet()) ?: emptySet()
    for (id in previous) cancel(context, id)

    val now = System.currentTimeMillis()
    val scheduled = mutableSetOf<String>()
    for (alarm in alarms) {
      if (alarm.at <= now) continue
      if (schedule(context, alarm)) scheduled.add(alarm.id)
    }
    prefs(context).edit().putStringSet(KEY_SCHEDULED, scheduled).apply()
    return scheduled.size
  }

  /** Пробна аларма след `delayMs` – не пипа списъка с истинските. */
  fun scheduleTest(context: Context, json: String, delayMs: Long): Boolean {
    val alarm = AlarmData.fromJson(json) ?: return false
    val o = JSONObject(alarm.json).put("id", TEST_ID).put("at", System.currentTimeMillis() + delayMs)
    return schedule(context, AlarmData.fromObject(o))
  }

  private fun intentFor(context: Context, id: String): Intent =
    Intent(context, AlarmReceiver::class.java)
      // data прави всяка аларма различна за PendingIntent (extras не се броят)
      .setData(Uri.parse("adhan://alarm/$id"))

  private fun schedule(context: Context, alarm: AlarmData): Boolean {
    if (!canScheduleExact(context)) return false
    val operation = PendingIntent.getBroadcast(
      context,
      0,
      intentFor(context, alarm.id).putExtra(EXTRA_ALARM, alarm.json),
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
    // при тап върху иконата на будилника в лентата горе – отваря приложението
    val launch = context.packageManager.getLaunchIntentForPackage(context.packageName) ?: Intent()
    val show = PendingIntent.getActivity(context, 0, launch, PendingIntent.FLAG_IMMUTABLE)
    return try {
      alarmManager(context).setAlarmClock(AlarmManager.AlarmClockInfo(alarm.at, show), operation)
      true
    } catch (e: SecurityException) {
      // „Аларми и напомняния“ е изключено
      Log.w(TAG, "setAlarmClock: ${e.message}")
      false
    }
  }

  private fun cancel(context: Context, id: String) {
    val pi = PendingIntent.getBroadcast(
      context,
      0,
      intentFor(context, id),
      PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE,
    ) ?: return
    alarmManager(context).cancel(pi)
    pi.cancel()
  }

  /* ------------------------------------------------------------ история (за „Проверка на известията“) */

  /** Записва, че алармата е звъннала – с планирания и истинския час. Пази последните 10. */
  fun recordFired(context: Context, alarm: AlarmData) {
    try {
      val arr = JSONArray(prefs(context).getString(KEY_HISTORY, null) ?: "[]")
      val item = JSONObject()
        .put("id", alarm.id)
        .put("title", alarm.notifTitle)
        .put("planned", alarm.at)
        .put("fired", System.currentTimeMillis())
      val next = JSONArray().put(item)
      for (i in 0 until minOf(arr.length(), 9)) next.put(arr.get(i))
      prefs(context).edit().putString(KEY_HISTORY, next.toString()).apply()
    } catch (e: Exception) {
      Log.w(TAG, "history: ${e.message}")
    }
  }

  fun historyJson(context: Context): String = prefs(context).getString(KEY_HISTORY, null) ?: "[]"
}
