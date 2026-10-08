package expo.modules.hayyanative

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.res.ColorStateList
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import android.graphics.Shader
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.graphics.drawable.RippleDrawable
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.text.TextUtils
import android.util.TypedValue
import android.view.Gravity
import android.view.KeyEvent
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.sin

/**
 * Екранът „Аларма“ на цял екран (по одобрения mockup v2): час, дата, арабското име
 * на молитвата, „Време е за …“, вълна с прогреса на езана, „Спри езана“ и „Заглуши звука“.
 * Показва се и върху заключения екран. Написан е изцяло на Kotlin, за да се отвори
 * веднага, без да се зарежда приложението.
 */
class AlarmActivity : Activity() {
  private val handler = Handler(Looper.getMainLooper())
  private var alarm: AlarmData? = null

  private lateinit var clock: TextView
  private lateinit var wave: WaveView
  private lateinit var bar: BarView
  private lateinit var timeText: TextView
  private lateinit var stopBtn: TextView
  private lateinit var muteBtn: TextView

  private val tick = object : Runnable {
    override fun run() {
      update()
      handler.postDelayed(this, 250)
    }
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
      setShowWhenLocked(true)
      setTurnScreenOn(true)
    } else {
      @Suppress("DEPRECATION")
      window.addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON)
    }
    window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

    val a = AlarmService.current ?: AlarmData.fromJson(intent.getStringExtra(AlarmScheduler.EXTRA_ALARM))
    if (a == null) {
      finish()
      return
    }
    alarm = a
    setContentView(build(a))
    edgeToEdge(a)
  }

  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    // нова аларма, докато екранът е отворен – наново
    val a = AlarmService.current ?: AlarmData.fromJson(intent.getStringExtra(AlarmScheduler.EXTRA_ALARM)) ?: return
    alarm = a
    setContentView(build(a))
    edgeToEdge(a)
  }

  override fun onResume() {
    super.onResume()
    handler.post(tick)
  }

  override fun onPause() {
    super.onPause()
    handler.removeCallbacks(tick)
  }

  /** Бутоните за звука заглушават езана – както при будилника. */
  override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
    if (keyCode == KeyEvent.KEYCODE_VOLUME_UP || keyCode == KeyEvent.KEYCODE_VOLUME_DOWN) {
      if (AlarmService.state == AlarmService.State.PLAYING) {
        AlarmService.command(this, AlarmService.ACTION_MUTE)
        return true
      }
    }
    return super.onKeyDown(keyCode, event)
  }

  /* ------------------------------------------------------------------ обновяване */

  private fun update() {
    val a = alarm ?: return
    val state = AlarmService.state
    // „Спри“ от известието или друга аларма – екранът се затваря
    if (state == AlarmService.State.IDLE || AlarmService.current?.id != a.id) {
      finish()
      return
    }
    clock.text = hm(System.currentTimeMillis())
    val playing = state == AlarmService.State.PLAYING
    val (pos, dur) = if (playing) AlarmService.progress() else Pair(AlarmService.lastDuration, AlarmService.lastDuration)
    val fraction = if (dur > 0) pos.toFloat() / dur else 0f
    wave.playing = playing
    wave.fraction = fraction
    bar.fraction = fraction
    timeText.text = if (dur > 0) "${mmss(pos)} / ${mmss(dur)}" else ""
    if (playing) {
      stopBtn.text = a.labels.stop
      muteBtn.visibility = View.VISIBLE
    } else {
      stopBtn.text = a.labels.close
      muteBtn.visibility = View.INVISIBLE
    }
  }

  private fun stopAlarm() {
    AlarmService.command(this, AlarmService.ACTION_STOP)
    finish()
  }

  /* ------------------------------------------------------------------ изглед */

  private fun dp(v: Float): Int = (v * resources.displayMetrics.density + 0.5f).toInt()

  private fun font(name: String): Typeface =
    try {
      Typeface.createFromAsset(assets, "hayya_fonts/$name.ttf")
    } catch (e: Exception) {
      Typeface.DEFAULT_BOLD
    }

  private fun text(
    value: String,
    size: Float,
    face: Typeface,
    color: Int = TEXT,
    unit: Int = TypedValue.COMPLEX_UNIT_SP,
  ): TextView =
    TextView(this).apply {
      text = value
      setTextSize(unit, size)
      typeface = face
      setTextColor(color)
      gravity = Gravity.CENTER
      includeFontPadding = false
    }

  private fun build(a: AlarmData): View {
    val extraBold = font("manrope_extrabold")
    val bold = font("manrope_bold")
    val semi = font("manrope_semibold")
    val regular = font("manrope_regular")
    val amiri = font("amiri_bold")

    val root = FrameLayout(this)
    root.addView(BackgroundView(this, a.colors), FrameLayout.LayoutParams(MATCH, MATCH))

    val column = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER_HORIZONTAL
    }
    root.addView(column, FrameLayout.LayoutParams(MATCH, MATCH))

    // ---- горе: ЕЗАН, часът, датата
    val top = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER_HORIZONTAL
      setPadding(0, dp(26f), 0, 0)
    }
    top.addView(text(a.labels.app.uppercase(), 11f, extraBold, alpha(TEXT, 0.65f)).apply { letterSpacing = 0.16f })
    clock = text(hm(System.currentTimeMillis()), 72f, extraBold, TEXT, TypedValue.COMPLEX_UNIT_DIP).apply {
      letterSpacing = -0.03f
      setPadding(0, dp(2f), 0, dp(2f))
    }
    top.addView(clock)
    top.addView(text(dateLine(a), 14f, regular, alpha(TEXT, 0.75f)))
    column.addView(top, LinearLayout.LayoutParams(MATCH, WRAP))

    // ---- среда: арабското име, „Време е за …“, мястото
    val mid = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER
      setPadding(dp(20f), 0, dp(20f), 0)
    }
    mid.addView(
      text(a.arabic, 64f, amiri, GOLD, TypedValue.COMPLEX_UNIT_DIP).apply {
        setShadowLayer(dp(15f).toFloat(), 0f, dp(4f).toFloat(), 0x59000000)
        includeFontPadding = true
      },
    )
    mid.addView(
      text(a.title, 21f, extraBold).apply {
        setPadding(0, dp(6f), 0, 0)
        maxLines = 2
        ellipsize = TextUtils.TruncateAt.END
      },
    )
    if (a.place.isNotEmpty()) {
      mid.addView(text(a.place, 13f, regular, alpha(TEXT, 0.7f)).apply { setPadding(0, dp(6f), 0, 0) })
    }
    column.addView(mid, LinearLayout.LayoutParams(MATCH, 0, 1f))

    // ---- картата със звука: вълна, име и време, прогрес
    val card = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      setPadding(dp(16f), dp(16f), dp(16f), dp(14f))
      background = GradientDrawable().apply {
        cornerRadius = dp(22f).toFloat()
        setColor(Color.argb(102, 6, 10, 20))
        setStroke(dp(1f), Color.argb(20, 255, 255, 255))
      }
    }
    wave = WaveView(this)
    card.addView(wave, LinearLayout.LayoutParams(MATCH, dp(38f)))
    val trackRow = LinearLayout(this).apply {
      orientation = LinearLayout.HORIZONTAL
      setPadding(0, dp(12f), 0, dp(12f))
    }
    trackRow.addView(
      text(a.labels.soundName, 12.5f, semi).apply { gravity = Gravity.START },
      LinearLayout.LayoutParams(0, WRAP, 1f),
    )
    timeText = text("", 12.5f, semi, alpha(TEXT, 0.65f)).apply { gravity = Gravity.END }
    trackRow.addView(timeText, LinearLayout.LayoutParams(WRAP, WRAP))
    card.addView(trackRow, LinearLayout.LayoutParams(MATCH, WRAP))
    bar = BarView(this)
    card.addView(bar, LinearLayout.LayoutParams(MATCH, dp(4f)))
    column.addView(
      card,
      LinearLayout.LayoutParams(MATCH, WRAP).apply {
        leftMargin = dp(22f)
        rightMargin = dp(22f)
      },
    )

    // ---- бутоните
    val actions = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      setPadding(dp(22f), dp(18f), dp(22f), dp(30f))
    }
    stopBtn = text(a.labels.stop, 17f, extraBold, GOLD_INK).apply {
      background = pill(GOLD, 0x33000000)
      isClickable = true
      setOnClickListener { stopAlarm() }
    }
    actions.addView(stopBtn, LinearLayout.LayoutParams(MATCH, dp(60f)))
    muteBtn = text(a.labels.mute, 14.5f, bold, alpha(TEXT, 0.85f)).apply {
      background = pill(Color.TRANSPARENT, 0x33FFFFFF)
      isClickable = true
      setOnClickListener { AlarmService.command(this@AlarmActivity, AlarmService.ACTION_MUTE) }
    }
    actions.addView(muteBtn, LinearLayout.LayoutParams(MATCH, dp(46f)).apply { topMargin = dp(8f) })
    column.addView(actions, LinearLayout.LayoutParams(MATCH, WRAP))

    // отстъп за лентите на системата (часовник горе, навигация долу)
    column.setOnApplyWindowInsetsListener { v, insets ->
      @Suppress("DEPRECATION")
      v.setPadding(0, insets.systemWindowInsetTop, 0, insets.systemWindowInsetBottom)
      insets
    }
    return root
  }

  private fun pill(color: Int, ripple: Int): RippleDrawable {
    val shape = GradientDrawable().apply {
      cornerRadius = dp(999f).toFloat()
      setColor(color)
    }
    val mask = GradientDrawable().apply {
      cornerRadius = dp(999f).toFloat()
      setColor(Color.WHITE)
    }
    return RippleDrawable(ColorStateList.valueOf(ripple), shape, mask)
  }

  /** Фонът минава под лентите на системата; те са прозрачни. */
  private fun edgeToEdge(a: AlarmData) {
    @Suppress("DEPRECATION")
    window.decorView.systemUiVisibility =
      View.SYSTEM_UI_FLAG_LAYOUT_STABLE or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
    @Suppress("DEPRECATION")
    window.statusBarColor = Color.TRANSPARENT
    @Suppress("DEPRECATION")
    window.navigationBarColor = Color.TRANSPARENT
    window.decorView.setBackgroundColor(a.colors[2])
  }

  /* ------------------------------------------------------------------ формати */

  private fun hm(ms: Long): String = SimpleDateFormat("HH:mm", Locale.US).format(Date(ms))

  private fun mmss(ms: Int): String {
    val s = ms / 1000
    return "${s / 60}:${(s % 60).toString().padStart(2, '0')}"
  }

  /** „Четвъртък, 1 октомври“ / „Thursday, 1 October“ */
  private fun dateLine(a: AlarmData): String {
    val locale = when (a.lang) {
      "bg" -> Locale("bg")
      "tr" -> Locale("tr")
      else -> Locale.UK
    }
    val s = SimpleDateFormat("EEEE, d MMMM", locale).format(Date(a.at))
    return s.replaceFirstChar { it.titlecase(locale) }
  }

  companion object {
    private const val MATCH = ViewGroup.LayoutParams.MATCH_PARENT
    private const val WRAP = ViewGroup.LayoutParams.WRAP_CONTENT
    val TEXT = Color.parseColor("#F2EFE8")
    val GOLD = Color.parseColor("#D4A857")
    val GOLD_INK = Color.parseColor("#1A1408")

    fun alpha(color: Int, a: Float): Int = Color.argb((a * 255).toInt(), Color.red(color), Color.green(color), Color.blue(color))
  }
}

/** Градиентът на молитвата + геометричната шарка (8-лъчева звезда) със 7,5% злато. */
private class BackgroundView(context: Context, private val colors: IntArray) : View(context) {
  private val fill = Paint()
  private val line = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    style = Paint.Style.STROKE
    color = AlarmActivity.alpha(AlarmActivity.GOLD, 0.075f)
    strokeWidth = context.resources.displayMetrics.density
  }
  private val tile = Path()

  override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
    fill.shader = LinearGradient(0f, 0f, 0f, h.toFloat(), colors, floatArrayOf(0f, 0.55f, 1f), Shader.TileMode.CLAMP)
    val u = context.resources.displayMetrics.density // 1 единица = 1 dp, плочката е 60 dp
    tile.reset()
    fun seg(x1: Float, y1: Float, x2: Float, y2: Float) {
      tile.moveTo(x1 * u, y1 * u)
      tile.lineTo(x2 * u, y2 * u)
    }
    tile.addRect(16 * u, 16 * u, 44 * u, 44 * u, Path.Direction.CW)
    tile.moveTo(30 * u, 10.2f * u)
    tile.lineTo(49.8f * u, 30 * u)
    tile.lineTo(30 * u, 49.8f * u)
    tile.lineTo(10.2f * u, 30 * u)
    tile.close()
    seg(0f, 0f, 16f, 16f)
    seg(60f, 0f, 44f, 16f)
    seg(0f, 60f, 16f, 44f)
    seg(60f, 60f, 44f, 44f)
    seg(30f, 0f, 30f, 10.2f)
    seg(30f, 49.8f, 30f, 60f)
    seg(0f, 30f, 10.2f, 30f)
    seg(49.8f, 30f, 60f, 30f)
    tile.addCircle(30 * u, 30 * u, 6 * u, Path.Direction.CW)
  }

  override fun onDraw(canvas: Canvas) {
    canvas.drawRect(0f, 0f, width.toFloat(), height.toFloat(), fill)
    val step = 60 * context.resources.displayMetrics.density
    var y = 0f
    while (y < height) {
      var x = 0f
      while (x < width) {
        canvas.save()
        canvas.translate(x, y)
        canvas.drawPath(tile, line)
        canvas.restore()
        x += step
      }
      y += step
    }
  }
}

/** Вълната: 30 златни черти, които „дишат“, докато звучи; изминалата част е по-ярка. */
private class WaveView(context: Context) : View(context) {
  var playing = true
  var fraction = 0f
  private val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = AlarmActivity.GOLD }
  private val rect = RectF()
  private val heights = FloatArray(BARS) { w -> (0.35f + 0.65f * abs(sin(w * 1.7) * cos(w * 0.45)).toFloat()) }

  override fun onDraw(canvas: Canvas) {
    val gap = 3 * context.resources.displayMetrics.density
    val barW = (width - gap * (BARS - 1)) / BARS
    val t = System.currentTimeMillis() / 1300.0 * 2 * Math.PI
    for (i in 0 until BARS) {
      val scale =
        if (playing) {
          val phase = (sin(t + i * 0.55) + 1) / 2 // 0..1
          (0.18f + (heights[i] - 0.18f) * phase.toFloat())
        } else {
          0.12f
        }
      val h = height * scale
      val x = i * (barW + gap)
      rect.set(x, (height - h) / 2, x + barW, (height + h) / 2)
      val played = (i + 0.5f) / BARS <= fraction
      paint.alpha = if (!playing) 128 else if (played) 255 else 115
      canvas.drawRoundRect(rect, barW / 2, barW / 2, paint)
    }
    if (playing) postInvalidateOnAnimation()
  }

  companion object {
    private const val BARS = 30
  }
}

/** Лентата на прогреса под вълната. */
private class BarView(context: Context) : View(context) {
  var fraction = 0f
    set(v) {
      field = v.coerceIn(0f, 1f)
      invalidate()
    }
  private val track = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.argb(36, 255, 255, 255) }
  private val fill = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = AlarmActivity.TEXT }
  private val rect = RectF()

  override fun onDraw(canvas: Canvas) {
    val r = height / 2f
    rect.set(0f, 0f, width.toFloat(), height.toFloat())
    canvas.drawRoundRect(rect, r, r, track)
    rect.set(0f, 0f, width * fraction, height.toFloat())
    canvas.drawRoundRect(rect, r, r, fill)
  }
}
