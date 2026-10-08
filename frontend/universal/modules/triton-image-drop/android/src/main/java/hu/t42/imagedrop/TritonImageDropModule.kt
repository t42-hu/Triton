package hu.t42.imagedrop

import android.view.View
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class TritonImageDropModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("TritonImageDrop")
    View(TritonImageDropView::class) {
      Events("onImage", "onDropError", "onDragStateChange")
      Prop("disabled") { view: TritonImageDropView, disabled: Boolean -> view.dropDisabled = disabled }
      GroupView<TritonImageDropView> {
        AddChildView { parent, child: View, index -> parent.addView(child, index) }
        GetChildCount { parent -> parent.childCount }
        GetChildViewAt { parent, index -> parent.getChildAt(index) }
        RemoveChildView { parent, child: View -> parent.removeView(child) }
        RemoveChildViewAt { parent, index -> parent.removeViewAt(index) }
      }
    }
  }
}
