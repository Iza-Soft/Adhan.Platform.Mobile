package expo.modules.adhannative

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Bundle
import android.os.Handler
import android.os.Looper

/**
 * Местоположение без Google услуги – с вградения в Android LocationManager (GPS + мрежа).
 * expo-location ползва Google Play Services и на Huawei без тях не работи;
 * затова там приложението вика това.
 */
object NativeLocation {
  /** Последна позиция, по-нова от това, се връща веднага. */
  private const val FRESH_MS = 2 * 60 * 1000L

  fun hasPermission(context: Context): Boolean =
    context.checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
      context.checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED

  /** Има ли Google Play Services (инсталирани и включени). */
  fun hasGoogleServices(context: Context): Boolean =
    try {
      context.packageManager.getApplicationInfo("com.google.android.gms", 0).enabled
    } catch (e: PackageManager.NameNotFoundException) {
      false
    }

  fun toMap(l: Location): Map<String, Any?> = mapOf(
    "latitude" to l.latitude,
    "longitude" to l.longitude,
    "accuracy" to (if (l.hasAccuracy()) l.accuracy.toDouble() else null),
    "timestamp" to l.time.toDouble(),
    "provider" to l.provider,
  )

  /** Най-новата известна позиция от всички източници (може да е стара). */
  @Suppress("MissingPermission")
  fun lastKnown(context: Context): Location? {
    if (!hasPermission(context)) return null
    val lm = context.getSystemService(Context.LOCATION_SERVICE) as LocationManager
    return lm.getProviders(true)
      .mapNotNull { p ->
        try {
          lm.getLastKnownLocation(p)
        } catch (e: Exception) {
          null
        }
      }
      .maxByOrNull { it.time }
  }

  /**
   * Текущата позиция: първият отговор от мрежата или GPS (по-бързият), иначе –
   * след `timeoutMs` последната известна. `done(null)` – няма позиция.
   */
  @Suppress("MissingPermission", "DEPRECATION")
  fun current(context: Context, timeoutMs: Long, done: (Location?) -> Unit) {
    if (!hasPermission(context)) {
      done(null)
      return
    }
    val last = lastKnown(context)
    if (last != null && System.currentTimeMillis() - last.time < FRESH_MS) {
      done(last)
      return
    }
    val lm = context.getSystemService(Context.LOCATION_SERVICE) as LocationManager
    val providers = listOf(LocationManager.NETWORK_PROVIDER, LocationManager.GPS_PROVIDER)
      .filter {
        try {
          lm.isProviderEnabled(it)
        } catch (e: Exception) {
          false
        }
      }
    if (providers.isEmpty()) {
      done(last)
      return
    }

    val main = Handler(Looper.getMainLooper())
    var finished = false
    val listeners = mutableListOf<LocationListener>()
    lateinit var timeout: Runnable

    fun finish(l: Location?) {
      if (finished) return
      finished = true
      main.removeCallbacks(timeout)
      listeners.forEach {
        try {
          lm.removeUpdates(it)
        } catch (e: Exception) {
          // нищо
        }
      }
      done(l)
    }
    timeout = Runnable { finish(lastKnown(context) ?: last) }

    for (p in providers) {
      val listener = object : LocationListener {
        override fun onLocationChanged(location: Location) = finish(location)
        override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) {}
        override fun onProviderEnabled(provider: String) {}
        override fun onProviderDisabled(provider: String) {}
      }
      listeners.add(listener)
      try {
        lm.requestLocationUpdates(p, 0L, 0f, listener, Looper.getMainLooper())
      } catch (e: Exception) {
        // този източник не става – другият може
      }
    }
    main.postDelayed(timeout, timeoutMs)
  }
}
