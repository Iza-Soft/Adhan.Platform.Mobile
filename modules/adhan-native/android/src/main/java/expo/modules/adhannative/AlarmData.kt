package expo.modules.adhannative

import android.graphics.Color
import org.json.JSONArray
import org.json.JSONObject

/**
 * Една аларма (езан за една молитва) – както я изпраща JavaScript частта.
 * Всички текстове идват готови от приложението (на езика на телефона),
 * за да може екранът „Аларма“ да се покаже и когато приложението е затворено.
 */
data class AlarmData(
  val id: String,
  /** Часът в милисекунди (UTC). */
  val at: Long,
  /** fajr, dhuhr, asr, maghrib, isha */
  val prayer: String,
  /** „Време е за Магриб“ */
  val title: String,
  /** „المغرب“ */
  val arabic: String,
  /** „София“ */
  val place: String,
  /** Заглавие и текст на известието. */
  val notifTitle: String,
  val notifBody: String,
  /** Фонът – трите цвята на молитвата (горе, среда, долу). */
  val colors: IntArray,
  val vibrate: Boolean,
  /** Звукът: името в res/raw без разширение („adhan_makkah“) или свой файл (file://…). */
  val sound: String,
  val labels: Labels,
  /** Езикът за датата на екрана: „bg“ или „en“. */
  val lang: String,
  /** Оригиналният JSON – пази се и се праща нататък непроменен. */
  val json: String,
) {
  data class Labels(
    /** „ЕЗАН“ */
    val app: String,
    /** „Спри езана“ */
    val stop: String,
    /** „Заглуши звука“ */
    val mute: String,
    /** „Заглуши“ – по-краткото за бутона в известието */
    val muteShort: String,
    /** „Затвори“ */
    val close: String,
    /** „Езан“ – името на звука под вълната */
    val soundName: String,
    /** „Аларма за молитва“ – името на канала в настройките на телефона */
    val channel: String,
  )

  companion object {
    fun fromJson(json: String?): AlarmData? {
      if (json.isNullOrEmpty()) return null
      return try {
        fromObject(JSONObject(json))
      } catch (e: Exception) {
        null
      }
    }

    fun fromObject(o: JSONObject): AlarmData {
      val l = o.optJSONObject("labels") ?: JSONObject()
      val c = o.optJSONArray("colors")
      val colors = IntArray(3) { i -> parseColor(c?.optString(i), DEFAULT_COLORS[i]) }
      return AlarmData(
        id = o.getString("id"),
        at = o.getLong("at"),
        prayer = o.optString("prayer"),
        title = o.optString("title"),
        arabic = o.optString("arabic"),
        place = o.optString("place"),
        notifTitle = o.optString("notifTitle"),
        notifBody = o.optString("notifBody"),
        colors = colors,
        vibrate = o.optBoolean("vibrate", true),
        sound = o.optString("sound", SoundSource.FALLBACK),
        labels = Labels(
          app = l.optString("app", "ADHAN"),
          stop = l.optString("stop", "Stop"),
          mute = l.optString("mute", "Mute"),
          muteShort = l.optString("muteShort", l.optString("mute", "Mute")),
          close = l.optString("close", "Close"),
          soundName = l.optString("soundName", "Adhan"),
          channel = l.optString("channel", "Prayer alarm"),
        ),
        lang = o.optString("lang", "en"),
        json = o.toString(),
      )
    }

    fun listFromJson(json: String?): List<AlarmData> {
      if (json.isNullOrEmpty()) return emptyList()
      return try {
        val arr = JSONArray(json)
        (0 until arr.length()).mapNotNull { i ->
          try {
            fromObject(arr.getJSONObject(i))
          } catch (e: Exception) {
            null
          }
        }
      } catch (e: Exception) {
        emptyList()
      }
    }

    private val DEFAULT_COLORS = intArrayOf(0xFF0F1B2D.toInt(), 0xFF0F1B2D.toInt(), 0xFF122238.toInt())

    private fun parseColor(s: String?, fallback: Int): Int =
      try {
        if (s.isNullOrEmpty()) fallback else Color.parseColor(s)
      } catch (e: Exception) {
        fallback
      }
  }
}
