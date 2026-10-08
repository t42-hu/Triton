import ExpoModulesCore

public class TritonImageDropModule: Module {
  public func definition() -> ModuleDefinition {
    Name("TritonImageDrop")
    View(TritonImageDropView.self) {
      Events("onImage", "onDropError", "onDragStateChange")
      Prop("disabled") { (view: TritonImageDropView, disabled: Bool) in view.dropDisabled = disabled }
    }
  }
}
