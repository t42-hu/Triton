package hu.t42.widget

import android.app.AlarmManager
import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.view.View
import android.widget.RemoteViews
import org.json.JSONObject

class TodayWidget : AppWidgetProvider() {
  override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) { refresh(context) }
  override fun onAppWidgetOptionsChanged(context: Context, manager: AppWidgetManager, id: Int, options: Bundle) { refresh(context) }
  override fun onReceive(context: Context, intent: Intent) {
    super.onReceive(context, intent)
    if (intent.action == "hu.t42.widget.TICK") refresh(context)
  }
  companion object {
    fun refresh(context: Context) {
      val manager = AppWidgetManager.getInstance(context)
      val ids = manager.getAppWidgetIds(ComponentName(context, TodayWidget::class.java))
      if (ids.isEmpty()) return
      val now = System.currentTimeMillis()
      val saved = context.getSharedPreferences("triton-widget", 0).getString("data", "{}") ?: "{}"
      val days = try { JSONObject(saved).optJSONArray("days") } catch (_: Exception) { null }
      var day: JSONObject? = null
      var next = now + 1800000
      if (days != null) for (i in 0 until days.length()) {
        val candidate = days.getJSONObject(i)
        val start = candidate.getLong("start"); val end = candidate.getLong("end")
        if (start > now) next = minOf(next, start)
        if (end > now) next = minOf(next, end)
        if (now >= start && now < end) day = candidate
      }
      val events = mutableListOf<JSONObject>()
      val list = day?.optJSONArray("events")
      if (list != null) for (i in 0 until list.length()) {
        val event = list.getJSONObject(i)
        val start = event.getLong("start"); val end = event.getLong("end")
        if (start > now) next = minOf(next, start)
        if (end >= now) next = minOf(next, end + 1)
        if (event.getBoolean("allDay") || end > now || start == end && start >= now) events.add(event)
      }
      for (id in ids) {
        val height = manager.getAppWidgetOptions(id).getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 180)
        val limit = ((height - 92) / 66).coerceIn(1, 6)
        val views = RemoteViews(context.packageName, R.layout.triton_today)
        views.setTextViewText(R.id.triton_date, day?.getString("label") ?: "Mai nap")
        views.removeAllViews(R.id.triton_events)
        for (event in events.take(limit)) {
          val row = RemoteViews(context.packageName, R.layout.triton_widget_event)
          val active = !event.getBoolean("allDay") && event.getLong("start") <= now
          row.setTextViewText(R.id.triton_event_time, (if (active) "Folyamatban · " else "") + event.getString("time"))
          row.setTextViewText(R.id.triton_event_title, event.getString("title"))
          row.setTextViewText(R.id.triton_event_location, event.getString("location"))
          row.setViewVisibility(R.id.triton_event_location, if (event.getString("location").isBlank()) View.GONE else View.VISIBLE)
          views.addView(R.id.triton_events, row)
        }
        views.setTextViewText(R.id.triton_more, if (day == null) "Nyisd meg a Triton42-t" else if (events.isEmpty()) "Ma nincs több esemény" else if (events.size > limit) "+${events.size - limit} esemény ma" else "Triton42")
        val open = context.packageManager.getLaunchIntentForPackage(context.packageName)
        if (open != null) views.setOnClickPendingIntent(R.id.triton_widget, PendingIntent.getActivity(context, 0, open, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE))
        manager.updateAppWidget(id, views)
      }
      // Inexact by design: event transitions do not require special alarm permission.
      val tick = PendingIntent.getBroadcast(context, 42, Intent(context, TodayWidget::class.java).setAction("hu.t42.widget.TICK"), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
      (context.getSystemService(Context.ALARM_SERVICE) as AlarmManager).setWindow(AlarmManager.RTC, maxOf(now + 1000, next), 60000, tick)
    }
  }
}
