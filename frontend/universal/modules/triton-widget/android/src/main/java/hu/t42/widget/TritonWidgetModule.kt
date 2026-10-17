package hu.t42.widget

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class TritonWidgetModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("TritonWidget")
    AsyncFunction("publish") { data: String ->
      val context = appContext.reactContext ?: return@AsyncFunction
      context.getSharedPreferences("triton-widget", 0).edit().putString("data", data).commit()
      TodayWidget.refresh(context)
    }
  }
}
