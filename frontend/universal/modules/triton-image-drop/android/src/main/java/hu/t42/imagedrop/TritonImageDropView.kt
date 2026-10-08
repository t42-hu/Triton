package hu.t42.imagedrop

import android.content.Context
import android.net.Uri
import android.view.DragEvent
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView
import java.io.File
import java.util.UUID

class TritonImageDropView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  var dropDisabled = false
  private var reading = false
  private val onImage by EventDispatcher<Map<String, Any>>()
  private val onDropError by EventDispatcher<Map<String, String>>()
  private val onDragStateChange by EventDispatcher<Map<String, Boolean>>()
  private val supported = setOf("image/jpeg", "image/png", "image/webp")

  init {
    setOnDragListener { _, event -> handleDrag(event) }
  }

  private fun handleDrag(event: DragEvent): Boolean {
    when (event.action) {
      DragEvent.ACTION_DRAG_STARTED -> return !dropDisabled && !reading && event.clipDescription?.hasMimeType("image/*") == true
      DragEvent.ACTION_DRAG_ENTERED -> onDragStateChange(mapOf("active" to !dropDisabled))
      DragEvent.ACTION_DRAG_EXITED, DragEvent.ACTION_DRAG_ENDED -> onDragStateChange(mapOf("active" to false))
      DragEvent.ACTION_DROP -> {
        onDragStateChange(mapOf("active" to false))
        if (dropDisabled || reading) return false
        val clip = event.clipData
        if (clip == null || clip.itemCount != 1) {
          onDropError(mapOf("message" to "Egyszerre egy képet húzz ide.")); return false
        }
        val uri = clip.getItemAt(0).uri ?: return false
        val permission = appContext.currentActivity?.requestDragAndDropPermissions(event)
        reading = true
        Thread {
          try { copyImage(uri) }
          catch (error: Exception) { post { onDropError(mapOf("message" to (error.message ?: "Nem sikerült megnyitni a képet."))) } }
          finally { permission?.release(); post { reading = false } }
        }.start()
      }
    }
    return true
  }

  private fun copyImage(uri: Uri) {
    val type = context.contentResolver.getType(uri)
    require(type in supported) { "JPEG, PNG vagy WebP képet válassz." }
    val extension = when (type) { "image/png" -> "png"; "image/webp" -> "webp"; else -> "jpg" }
    val file = File(context.cacheDir, "triton-profile-drop-${UUID.randomUUID()}.$extension")
    try {
      val input = context.contentResolver.openInputStream(uri) ?: error("Nem sikerült megnyitni a képet.")
      input.use { source ->
        file.outputStream().use { target ->
          val buffer = ByteArray(8192)
          var size = 0
          while (true) {
            val count = source.read(buffer)
            if (count < 0) break
            size += count
            require(size <= 5 * 1024 * 1024) { "A kép legfeljebb 5 MB lehet." }
            target.write(buffer, 0, count)
          }
        }
      }
      require(file.length() > 0) { "A kiválasztott kép üres." }
      post { onImage(mapOf("uri" to Uri.fromFile(file).toString(), "name" to file.name, "mimeType" to type!!, "size" to file.length(), "temporary" to true)) }
    } catch (error: Exception) {
      file.delete(); throw error
    }
  }
}
