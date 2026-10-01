package expo.modules.adhannative

import android.app.AlarmManager
import android.app.NotificationManager
import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Native модулът на Езан (само Android):
 * - етап 4: точни известия (Android 12+);
 * - етап 5: алармата с пълния езан (AlarmManager.setAlarmClock + foreground service +
 *   екран „Аларма“), аларма на цял екран (Android 14+), работа на заден план
 *   (оптимизация на батерията) и местоположение без Google услуги (Huawei).
 */
class AdhanNativeModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private val packageUri: Uri
    get() = Uri.parse("package:${context.packageName}")

  private fun open(intent: Intent, fallback: Intent? = null) {
    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    try {
      context.startActivity(intent)
    } catch (e: ActivityNotFoundException) {
      val f = fallback ?: Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, packageUri)
      context.startActivity(f.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }
  }

  override fun definition() = ModuleDefinition {
    Name("AdhanNative")

    /* -------------------------------------------------- точни аларми (етап 4) */

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
      val intent =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
          Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, packageUri)
        } else {
          Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, packageUri)
        }
      open(intent)
    }

    /* -------------------------------------------------- алармата с езана (етап 5) */

    // Заменя всички аларми (JSON масив, виж AlarmData). Връща колко са планирани.
    Function("setAlarms") { json: String ->
      AlarmScheduler.setAlarms(context, json)
    }

    // Запазеният списък (JSON) – за „Проверка на известията“.
    Function("getAlarms") {
      AlarmScheduler.storedJson(context)
    }

    // Последните звъннали аларми (JSON): планиран и истински час.
    Function("getAlarmHistory") {
      AlarmScheduler.historyJson(context)
    }

    // Пробна аларма след delayMs.
    Function("testAlarm") { json: String, delayMs: Double ->
      AlarmScheduler.scheduleTest(context, json, delayMs.toLong())
    }

    Function("stopAlarm") {
      AlarmService.command(context, AlarmService.ACTION_STOP)
    }

    /* -------------------------------------------------- звуци (етап 6) */

    // Преслушване: вграден звук (res/raw) или свой файл (file://…).
    Function("previewSound") { source: String ->
      SoundPreview.play(context, source)
    }

    Function("stopPreview") {
      SoundPreview.stop()
    }

    // Свой кратък звук: откъс до maxSec (срез на пауза, заглъхване) в Notifications/Ezan.
    AsyncFunction("prepareShortSound") { uri: String, title: String, maxSec: Double ->
      val r = ShortSound.prepare(context, uri, title, maxSec)
      mapOf(
        "uri" to r.uri,
        "duration" to r.duration,
        "originalDuration" to r.originalDuration,
        "trimmed" to r.trimmed,
      )
    }

    Function("deleteShortSound") { uri: String ->
      ShortSound.delete(context, uri)
    }

    // Канал за известие със свой звук (content://…).
    Function("createSoundChannel") { id: String, name: String, uri: String, alarm: Boolean, vibrate: Boolean, pattern: List<Double> ->
      ShortSound.createChannel(context, id, name, uri, alarm, vibrate, pattern.map { it.toLong() }.toLongArray())
    }

    // Дължината на звуков файл в секунди; −1 – не е звук или не може да се прочете.
    AsyncFunction("getAudioDuration") { uri: String ->
      SoundSource.durationSec(context, uri)
    }

    /* -------------------------------------------------- аларма на цял екран (Android 14+) */

    Function("canUseFullScreenIntent") {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
        true
      } else {
        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        nm.canUseFullScreenIntent()
      }
    }

    Function("openFullScreenIntentSettings") {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
        open(Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT, packageUri))
      } else {
        open(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, packageUri))
      }
    }

    /* -------------------------------------------------- работа на заден план */

    // true – телефонът не ограничава Езан (оптимизацията на батерията е изключена за него).
    Function("isIgnoringBatteryOptimizations") {
      val pm = context.getSystemService(Context.POWER_SERVICE) as PowerManager
      pm.isIgnoringBatteryOptimizations(context.packageName)
    }

    // Настройките на Езан в телефона (оттам: Батерия → Без ограничения).
    Function("openAppSettings") {
      open(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, packageUri))
    }

    // Списъкът „Оптимизация на батерията“ на Android.
    Function("openBatteryOptimizationSettings") {
      open(Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS))
    }

    /* -------------------------------------------------- местоположение без Google (Huawei) */

    Function("hasGoogleServices") {
      NativeLocation.hasGoogleServices(context)
    }

    AsyncFunction("getCurrentLocation") { timeoutMs: Double, promise: Promise ->
      val ctx = context
      if (!NativeLocation.hasPermission(ctx)) {
        promise.resolve(null)
        return@AsyncFunction
      }
      NativeLocation.current(ctx, timeoutMs.toLong()) { location ->
        promise.resolve(location?.let { NativeLocation.toMap(it) })
      }
    }
  }
}
