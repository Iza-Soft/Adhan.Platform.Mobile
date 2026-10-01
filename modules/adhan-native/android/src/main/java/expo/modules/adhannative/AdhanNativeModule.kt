package expo.modules.adhannative

import android.app.AlarmManager
import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Малкият native модул на Езан (само Android).
 * Етап 4: точни известия (Android 12+). В етап 5 тук идват алармата с пълния езан
 * и местоположението без Google услуги.
 */
class AdhanNativeModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("AdhanNative")

    // Може ли приложението да планира точни аларми. До Android 12 – винаги да.
    // От Android 14 разрешението „Аларми и напомняния“ е изключено по подразбиране.
    Function("canScheduleExactAlarms") {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
        true
      } else {
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        alarmManager.canScheduleExactAlarms()
      }
    }

    // Отваря системния екран „Аларми и напомняния“ за Езан.
    // Ако производителят го е махнал – екрана с информация за приложението.
    Function("openExactAlarmSettings") {
      val packageUri = Uri.parse("package:${context.packageName}")
      val intent =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
          Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, packageUri)
        } else {
          Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, packageUri)
        }
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      try {
        context.startActivity(intent)
      } catch (e: ActivityNotFoundException) {
        context.startActivity(
          Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, packageUri).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        )
      }
    }
  }
}
