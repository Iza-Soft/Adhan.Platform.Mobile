package expo.modules.hayyanative

import android.app.AlarmManager
import android.app.NotificationManager
import android.content.ActivityNotFoundException
import android.content.ComponentName
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
 *   (оптимизация на батерията) и местоположение без Google услуги (Huawei);
 * - етап 6: звуците; етап 8: widget-ите (PrayerWidgets.kt); етап 12: навигацията до джамия.
 */
class HayyaNativeModule : Module() {
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
    Name("HayyaNative")

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

    // Huawei / Honor: екранът „Стартиране на приложения“ (App launch) на телефона.
    // Пробва познатите места според версията на EMUI / HarmonyOS / MagicOS; ако никое не се
    // отвори – екранът „Батерия“ (стандартен за Android), където „Стартиране на приложения“
    // е един ред по-надолу. true – отвори се направо екранът на Huawei.
    Function("openAppLaunchSettings") {
      openAppLaunch()
    }

    /* -------------------------------------------------- навигация до джамия (етап 12) */

    // Инсталирано ли е приложението (пакетите са изброени в <queries> в AndroidManifest.xml).
    Function("isAppInstalled") { pkg: String ->
      try {
        context.packageManager.getPackageInfo(pkg, 0)
        true
      } catch (e: Exception) {
        false
      }
    }

    // Отваря връзката точно в това приложение (или – без пакет – в каквото избере телефонът).
    // false – няма такова приложение.
    Function("openInApp") { url: String, pkg: String? ->
      val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      if (!pkg.isNullOrEmpty()) intent.setPackage(pkg)
      try {
        context.startActivity(intent)
        true
      } catch (e: ActivityNotFoundException) {
        false
      } catch (e: Exception) {
        false
      }
    }

    // Иконата на приложението като PNG (base64) – за списъка с навигации. null – няма го.
    Function("appIcon") { pkg: String, size: Int ->
      try {
        val drawable = context.packageManager.getApplicationIcon(pkg)
        val px = size.coerceIn(24, 256)
        val bitmap = android.graphics.Bitmap.createBitmap(px, px, android.graphics.Bitmap.Config.ARGB_8888)
        val canvas = android.graphics.Canvas(bitmap)
        drawable.setBounds(0, 0, px, px)
        drawable.draw(canvas)
        val out = java.io.ByteArrayOutputStream()
        bitmap.compress(android.graphics.Bitmap.CompressFormat.PNG, 100, out)
        bitmap.recycle()
        android.util.Base64.encodeToString(out.toByteArray(), android.util.Base64.NO_WRAP)
      } catch (e: Exception) {
        null
      }
    }

    /* -------------------------------------------------- widget-и (етап 8) */

    // Кадрите на widget-ите (JSON от src/domain/widget.ts): записва ги и прерисува widget-ите.
    Function("setWidgetData") { json: String ->
      PrayerWidgets.setData(context, json)
    }

    // Колко widget-а на Езан има на началния екран.
    Function("getWidgetCount") {
      PrayerWidgets.count(context)
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

  private fun openAppLaunch(): Boolean {
    for ((pkg, cls) in APP_LAUNCH_SCREENS) {
      val intent = Intent().setComponent(ComponentName(pkg, cls)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      try {
        context.startActivity(intent)
        return true
      } catch (e: Exception) {
        // ActivityNotFoundException или SecurityException (екранът не е отворен за други приложения)
      }
    }
    // „Батерия“; ако и него го няма – настройките на приложението
    open(Intent(Intent.ACTION_POWER_USAGE_SUMMARY))
    return false
  }

  private companion object {
    /** „Стартиране на приложения“ – от най-новите към по-старите версии. */
    val APP_LAUNCH_SCREENS = listOf(
      "com.huawei.systemmanager" to "com.huawei.systemmanager.startupmgr.ui.StartupNormalAppListActivity",
      "com.hihonor.systemmanager" to "com.hihonor.systemmanager.startupmgr.ui.StartupNormalAppListActivity",
      "com.huawei.systemmanager" to "com.huawei.systemmanager.appcontrol.activity.StartupAppControlActivity",
      "com.huawei.systemmanager" to "com.huawei.systemmanager.optimize.process.ProtectActivity",
    )
  }
}
