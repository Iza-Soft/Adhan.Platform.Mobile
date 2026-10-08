package expo.modules.hayyanative

import android.app.Notification
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log

/**
 * Обикновеното известие или напомняне (Android), планирано от AlarmScheduler със setAlarmClock
 * като алармата – затова идва точно и когато телефонът спи (Huawei отлага „точните известия“
 * на expo-notifications, докато телефонът не се събуди). Звукът и вибрацията са от канала,
 * който приложението вече е създало (src/services/notifications.ts → ensureChannel).
 */
object NotifyPoster {
  private const val TAG = "HayyaNotify"

  fun post(context: Context, alarm: AlarmData) {
    try {
      val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      if (!nm.areNotificationsEnabled()) return

      val launch = context.packageManager.getLaunchIntentForPackage(context.packageName)
        ?.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
      val open = launch?.let {
        PendingIntent.getActivity(context, alarm.id.hashCode(), it, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
      }

      val builder =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
          Notification.Builder(context, alarm.channel)
        } else {
          @Suppress("DEPRECATION")
          Notification.Builder(context)
            .setPriority(Notification.PRIORITY_HIGH)
            .setDefaults(Notification.DEFAULT_ALL)
        }
      builder
        .setSmallIcon(smallIcon(context))
        .setColor(0xFFD4A857.toInt())
        .setContentTitle(alarm.notifTitle)
        .setContentText(alarm.notifBody.lineSequence().firstOrNull() ?: "")
        .setStyle(Notification.BigTextStyle().bigText(alarm.notifBody))
        .setCategory(if (alarm.kind == "reminder") Notification.CATEGORY_REMINDER else Notification.CATEGORY_EVENT)
        .setVisibility(Notification.VISIBILITY_PUBLIC)
        .setAutoCancel(true)
        .setShowWhen(true)
        .setWhen(alarm.at)
      open?.let { builder.setContentIntent(it) }
      nm.notify(alarm.id.hashCode(), builder.build())
    } catch (e: Exception) {
      Log.w(TAG, "post: ${e.message}")
    }
  }

  /** Иконата на известията от app.json (expo-notifications → notification_icon). */
  private fun smallIcon(context: Context): Int {
    val id = context.resources.getIdentifier("notification_icon", "drawable", context.packageName)
    return if (id != 0) id else context.applicationInfo.icon
  }
}
