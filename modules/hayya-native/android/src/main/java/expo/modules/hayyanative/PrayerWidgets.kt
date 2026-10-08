package expo.modules.hayyanative

import android.app.AlarmManager
import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.BroadcastReceiver
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Typeface
import android.os.Build
import android.os.SystemClock
import android.text.SpannableString
import android.text.Spanned
import android.text.style.StyleSpan
import android.util.Log
import android.view.View
import android.widget.RemoteViews

/**
 * Widget-ите на Езан за Android (етап 8) – по одобрения mockup:
 * - „Следваща“ 2×2 (NextPrayerWidget), „Денят“ 4×2 (DayWidget), „Лента“ 4×1 (BarWidget).
 *
 * Как се обновяват, без да хабят батерия:
 * - оставащото време е Chronometer – брои го системата всяка секунда, без приложението;
 * - в часа на всяка молитва и в полунощ AlarmManager (RTC, без събуждане на телефона) вика
 *   WidgetRefreshReceiver – той показва новия кадър (нова молитва, нов фон);
 *   ако телефонът спи, обновяването става, щом екранът светне;
 * - и при рестарт, смяна на часа/часовата зона, обновяване на приложението (BootReceiver)
 *   и всеки път, когато приложението даде нови кадри (setWidgetData).
 */
object PrayerWidgets {
  private const val TAG = "HayyaWidget"
  private const val REFRESH_REQUEST = 0xEA0108
  private const val OPEN_REQUEST = 0xEA0109

  private val PROVIDERS = listOf(
    NextPrayerWidget::class.java,
    DayWidget::class.java,
    BarWidget::class.java,
  )

  private val GOLD = 0xFFD4A857.toInt()
  private val TEXT = 0xFFF2EFE8.toInt()
  private val DIM = 0xC7F2EFE8.toInt() // 78%
  private val PAST = 0x73F2EFE8 // 45%
  private val LATER = 0xD9F2EFE8.toInt() // 85%

  private val ROW_IDS = arrayOf(
    intArrayOf(R.id.ezan_row0, R.id.ezan_row0_name, R.id.ezan_row0_time),
    intArrayOf(R.id.ezan_row1, R.id.ezan_row1_name, R.id.ezan_row1_time),
    intArrayOf(R.id.ezan_row2, R.id.ezan_row2_name, R.id.ezan_row2_time),
    intArrayOf(R.id.ezan_row3, R.id.ezan_row3_name, R.id.ezan_row3_time),
    intArrayOf(R.id.ezan_row4, R.id.ezan_row4_name, R.id.ezan_row4_time),
    intArrayOf(R.id.ezan_row5, R.id.ezan_row5_name, R.id.ezan_row5_time),
  )

  /** Колко widget-а на Езан има на началния екран. */
  fun count(context: Context): Int {
    val manager = AppWidgetManager.getInstance(context) ?: return 0
    return PROVIDERS.sumOf { manager.getAppWidgetIds(ComponentName(context, it)).size }
  }

  /** Новите кадри от приложението: записва ги и прерисува widget-ите, ако има промяна. */
  fun setData(context: Context, json: String) {
    if (WidgetStore.save(context, json)) updateAll(context) else scheduleNext(context)
  }

  /** Прерисува всички widget-и на Езан и планира следващото обновяване. */
  fun updateAll(context: Context) {
    try {
      val manager = AppWidgetManager.getInstance(context) ?: return
      for (cls in PROVIDERS) {
        val ids = manager.getAppWidgetIds(ComponentName(context, cls))
        if (ids.isNotEmpty()) update(context, manager, ids, kindOf(cls))
      }
    } catch (e: Exception) {
      Log.w(TAG, "update: ${e.message}")
    }
    scheduleNext(context)
  }

  enum class Kind { NEXT, DAY, BAR }

  private fun kindOf(cls: Class<*>): Kind = when (cls) {
    DayWidget::class.java -> Kind.DAY
    BarWidget::class.java -> Kind.BAR
    else -> Kind.NEXT
  }

  fun update(context: Context, manager: AppWidgetManager, ids: IntArray, kind: Kind) {
    val data = WidgetStore.load(context)
    val now = System.currentTimeMillis()
    val entry = WidgetStore.current(data, now)
    val views = when (kind) {
      Kind.NEXT -> RemoteViews(context.packageName, R.layout.ezan_widget_next)
      Kind.DAY -> RemoteViews(context.packageName, R.layout.ezan_widget_day)
      Kind.BAR -> RemoteViews(context.packageName, R.layout.ezan_widget_bar)
    }
    if (entry == null) {
      renderEmpty(context, views, kind, data.emptyText)
    } else {
      render(context, views, kind, entry, now)
    }
    // силуетът (Настройки → Изглед): „Следваща“ 2×2 – в десния ъгъл, „Ден“ 4×2 – в левия; „Лента“ няма
    if (kind != Kind.BAR) views.setImageViewResource(R.id.ezan_dome, skyline(data.skyline))
    launchIntent(context)?.let { views.setOnClickPendingIntent(R.id.ezan_widget_root, it) }
    for (id in ids) manager.updateAppWidget(id, views)
  }

  private fun render(context: Context, v: RemoteViews, kind: Kind, e: WidgetStore.Entry, now: Long) {
    v.setInt(R.id.ezan_widget_root, "setBackgroundResource", background(e.phase, kind == Kind.BAR))
    v.setTextViewText(R.id.ezan_arabic, e.nextArabic)
    v.setViewVisibility(R.id.ezan_count, View.VISIBLE)
    // оставащото време: Chronometer брои до часа на молитвата сам
    val base = SystemClock.elapsedRealtime() + (e.nextAt - now)
    v.setChronometer(R.id.ezan_count, base, null, true)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) v.setChronometerCountDown(R.id.ezan_count, true)

    when (kind) {
      Kind.NEXT -> {
        v.setTextViewText(R.id.ezan_place, e.place)
        v.setTextViewText(R.id.ezan_name, e.nextName)
        v.setTextViewText(R.id.ezan_at, e.shortAt)
        v.setViewVisibility(R.id.ezan_at, View.VISIBLE)
        v.setTextViewText(R.id.ezan_until, e.untilText)
        v.setViewVisibility(R.id.ezan_until, View.VISIBLE)
        v.setViewVisibility(R.id.ezan_dome, View.VISIBLE)
      }
      Kind.DAY -> {
        v.setTextViewText(R.id.ezan_place, e.place)
        v.setTextViewText(R.id.ezan_label, "${e.nextLabel} · ")
        v.setTextViewText(R.id.ezan_name, e.nextName)
        v.setViewVisibility(R.id.ezan_label_row, View.VISIBLE)
        v.setTextViewText(R.id.ezan_at, e.atText)
        v.setViewVisibility(R.id.ezan_at, View.VISIBLE)
        v.setViewVisibility(R.id.ezan_rows, View.VISIBLE)
        v.setViewVisibility(R.id.ezan_empty, View.GONE)
        for ((i, ids) in ROW_IDS.withIndex()) {
          val r = e.rows.getOrNull(i)
          if (r == null) {
            v.setViewVisibility(ids[0], View.GONE)
            continue
          }
          v.setViewVisibility(ids[0], View.VISIBLE)
          val strong = r.state == "now" || r.state == "next"
          val color = when (r.state) {
            "now" -> GOLD
            "past" -> PAST
            "next" -> TEXT
            else -> LATER
          }
          v.setTextViewText(ids[1], styled(r.name, strong))
          v.setTextViewText(ids[2], styled(r.time, strong))
          v.setTextColor(ids[1], color)
          v.setTextColor(ids[2], color)
          v.setInt(ids[0], "setBackgroundResource", if (r.state == "now") R.drawable.ezan_widget_row_now else 0)
        }
      }
      Kind.BAR -> {
        v.setTextViewText(R.id.ezan_place, e.place)
        v.setViewVisibility(R.id.ezan_place, View.VISIBLE)
        v.setTextViewText(R.id.ezan_name, e.nextName)
        v.setTextViewText(R.id.ezan_at, " ${e.atText}")
        v.setViewVisibility(R.id.ezan_at, View.VISIBLE)
      }
    }
  }

  /** Няма кадри (приложението не е отваряно или не е отваряно 7 дни): „Отвори Езан…“. */
  private fun renderEmpty(context: Context, v: RemoteViews, kind: Kind, emptyText: String?) {
    val text = emptyText ?: context.getString(R.string.ezan_widget_empty)
    v.setInt(R.id.ezan_widget_root, "setBackgroundResource", if (kind == Kind.BAR) R.drawable.ezan_widget_bg_empty_h else R.drawable.ezan_widget_bg_empty)
    v.setTextViewText(R.id.ezan_arabic, "أذان")
    v.setViewVisibility(R.id.ezan_count, View.GONE)
    v.setChronometer(R.id.ezan_count, SystemClock.elapsedRealtime(), null, false)
    when (kind) {
      Kind.NEXT -> {
        v.setTextViewText(R.id.ezan_place, "")
        v.setTextViewText(R.id.ezan_name, text)
        v.setViewVisibility(R.id.ezan_at, View.GONE)
        v.setViewVisibility(R.id.ezan_until, View.GONE)
        v.setViewVisibility(R.id.ezan_dome, View.GONE)
      }
      Kind.DAY -> {
        v.setTextViewText(R.id.ezan_place, "")
        v.setViewVisibility(R.id.ezan_label_row, View.GONE)
        v.setViewVisibility(R.id.ezan_at, View.GONE)
        v.setViewVisibility(R.id.ezan_rows, View.GONE)
        v.setViewVisibility(R.id.ezan_empty, View.VISIBLE)
        v.setTextViewText(R.id.ezan_empty, text)
      }
      Kind.BAR -> {
        v.setViewVisibility(R.id.ezan_place, View.GONE)
        v.setTextViewText(R.id.ezan_name, text)
        v.setViewVisibility(R.id.ezan_at, View.GONE)
      }
    }
  }

  private fun styled(text: String, bold: Boolean): CharSequence {
    if (!bold) return text
    val s = SpannableString(text)
    s.setSpan(StyleSpan(Typeface.BOLD), 0, text.length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
    return s
  }

  /** Силуетът в ъгъла на „Следваща“ и „Ден“ – както е избран в Настройки → Изглед. */
  private fun skyline(id: String): Int = when (id) {
    "haram" -> R.drawable.ezan_widget_haram
    "nabawi" -> R.drawable.ezan_widget_nabawi
    "aqsa" -> R.drawable.ezan_widget_aqsa
    else -> R.drawable.ezan_widget_dome
  }

  /** Фонът: градиентът на текущата молитва (вертикален; за „Лента“ – хоризонтален). */
  private fun background(phase: String, horizontal: Boolean): Int =
    if (horizontal) {
      when (phase) {
        "fajr" -> R.drawable.ezan_widget_bg_fajr_h
        "sunrise" -> R.drawable.ezan_widget_bg_sunrise_h
        "dhuhr" -> R.drawable.ezan_widget_bg_dhuhr_h
        "asr" -> R.drawable.ezan_widget_bg_asr_h
        "maghrib" -> R.drawable.ezan_widget_bg_maghrib_h
        "isha" -> R.drawable.ezan_widget_bg_isha_h
        else -> R.drawable.ezan_widget_bg_empty_h
      }
    } else {
      when (phase) {
        "fajr" -> R.drawable.ezan_widget_bg_fajr
        "sunrise" -> R.drawable.ezan_widget_bg_sunrise
        "dhuhr" -> R.drawable.ezan_widget_bg_dhuhr
        "asr" -> R.drawable.ezan_widget_bg_asr
        "maghrib" -> R.drawable.ezan_widget_bg_maghrib
        "isha" -> R.drawable.ezan_widget_bg_isha
        else -> R.drawable.ezan_widget_bg_empty
      }
    }

  private fun launchIntent(context: Context): PendingIntent? {
    val intent = context.packageManager.getLaunchIntentForPackage(context.packageName) ?: return null
    intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED
    return PendingIntent.getActivity(
      context,
      OPEN_REQUEST,
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
  }

  /* ---------------------------------------------------------------- следващото обновяване */

  private fun refreshIntent(context: Context): PendingIntent =
    PendingIntent.getBroadcast(
      context,
      REFRESH_REQUEST,
      Intent(context, WidgetRefreshReceiver::class.java),
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

  /**
   * Планира обновяване в часа на следващата смяна (молитва или полунощ).
   * RTC – не буди телефона: ако спи, обновяването идва, щом се събуди (тогава го и виждаш).
   * Без widget-и на екрана – нищо не се планира.
   */
  fun scheduleNext(context: Context) {
    val am = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
    val pi = refreshIntent(context)
    am.cancel(pi)
    if (count(context) == 0) return
    val at = WidgetStore.nextChange(WidgetStore.load(context), System.currentTimeMillis()) ?: return
    try {
      if (AlarmScheduler.canScheduleExact(context)) {
        am.setExact(AlarmManager.RTC, at, pi)
      } else {
        // без „Аларми и напомняния“ – в прозорец от минута (Android 12+ го разширява до ~10 мин.);
        // set() може да закъснее с часове
        am.setWindow(AlarmManager.RTC, at, 60_000L, pi)
      }
    } catch (e: SecurityException) {
      am.setWindow(AlarmManager.RTC, at, 60_000L, pi)
    }
  }
}

/** Общото за трите widget-а: системата вика onUpdate при поставяне и на всеки час (резерва). */
abstract class PrayerWidgetProvider(private val kind: PrayerWidgets.Kind) : AppWidgetProvider() {
  override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
    try {
      PrayerWidgets.update(context, manager, ids, kind)
    } catch (e: Exception) {
      Log.w("HayyaWidget", "onUpdate: ${e.message}")
    }
    PrayerWidgets.scheduleNext(context)
  }

  override fun onDisabled(context: Context) {
    // последният widget от този вид е махнат – ако няма други, scheduleNext спира обновяването
    PrayerWidgets.scheduleNext(context)
  }
}

/** „Следваща“ 2×2. */
class NextPrayerWidget : PrayerWidgetProvider(PrayerWidgets.Kind.NEXT)

/** „Денят“ 4×2. */
class DayWidget : PrayerWidgetProvider(PrayerWidgets.Kind.DAY)

/** „Лента“ 4×1. */
class BarWidget : PrayerWidgetProvider(PrayerWidgets.Kind.BAR)

/** В часа на всяка молитва и в полунощ – новият кадър. */
class WidgetRefreshReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    PrayerWidgets.updateAll(context)
  }
}

