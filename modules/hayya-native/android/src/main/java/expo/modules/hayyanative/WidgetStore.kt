package expo.modules.hayyanative

import android.content.Context
import org.json.JSONObject

/**
 * Кадрите на widget-ите (етап 8) – както ги изчислява приложението (src/domain/widget.ts):
 * нов кадър в часа на всяка молитва и в полунощ, за 7 дни напред. Пазят се в
 * SharedPreferences, за да ги има и когато приложението е затворено или след рестарт.
 */
object WidgetStore {
  private const val PREFS = "ezan_widgets"
  private const val KEY = "data"

  data class Row(val name: String, val time: String, val state: String)

  data class Entry(
    val from: Long,
    val phase: String,
    val place: String,
    val nextName: String,
    val nextArabic: String,
    val nextTime: String,
    val nextAt: Long,
    val prevAt: Long,
    val nextLabel: String,
    val atText: String,
    val shortAt: String,
    val untilText: String,
    val rows: List<Row>,
  )

  /** skyline – силуетът в ъгъла на „Следваща“ (Настройки → Изглед): dome, haram, nabawi, aqsa. */
  data class Data(val emptyText: String?, val entries: List<Entry>, val skyline: String = "dome")

  private fun prefs(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  /** Записва новите кадри. false – JSON-ът е същият като досега (няма нужда от обновяване). */
  fun save(context: Context, json: String): Boolean {
    val p = prefs(context)
    if (p.getString(KEY, null) == json) return false
    p.edit().putString(KEY, json).apply()
    return true
  }

  fun load(context: Context): Data {
    val json = prefs(context).getString(KEY, null) ?: return Data(null, emptyList())
    return try {
      val o = JSONObject(json)
      val arr = o.optJSONArray("entries")
      val entries = mutableListOf<Entry>()
      if (arr != null) {
        for (i in 0 until arr.length()) {
          val e = arr.optJSONObject(i) ?: continue
          val rowsArr = e.optJSONArray("rows")
          val rows = mutableListOf<Row>()
          if (rowsArr != null) {
            for (j in 0 until rowsArr.length()) {
              val r = rowsArr.optJSONObject(j) ?: continue
              rows.add(Row(r.optString("name"), r.optString("time"), r.optString("state")))
            }
          }
          entries.add(
            Entry(
              from = e.optLong("from"),
              phase = e.optString("phase"),
              place = e.optString("place"),
              nextName = e.optString("nextName"),
              nextArabic = e.optString("nextArabic"),
              nextTime = e.optString("nextTime"),
              nextAt = e.optLong("nextAt"),
              prevAt = e.optLong("prevAt"),
              nextLabel = e.optString("nextLabel"),
              atText = e.optString("atText"),
              shortAt = e.optString("shortAt"),
              untilText = e.optString("untilText"),
              rows = rows,
            ),
          )
        }
      }
      Data(o.optString("emptyText").ifEmpty { null }, entries.sortedBy { it.from }, o.optString("skyline").ifEmpty { "dome" })
    } catch (e: Exception) {
      Data(null, emptyList())
    }
  }

  /** Кадърът, който важи в момента `now`; null – няма кадри или са свършили (7 дни без приложението). */
  fun current(data: Data, now: Long): Entry? {
    val e = data.entries.lastOrNull { it.from <= now } ?: data.entries.firstOrNull() ?: return null
    return if (now >= e.nextAt) null else e
  }

  /** Кога трябва следващото обновяване: следващият кадър (или краят на текущия). */
  fun nextChange(data: Data, now: Long): Long? {
    val next = data.entries.firstOrNull { it.from > now }?.from
    val end = current(data, now)?.nextAt
    return listOfNotNull(next, end).minOrNull()
  }
}
