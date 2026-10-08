import ExpoModulesCore
import UniformTypeIdentifiers
import UIKit

class TritonImageDropView: ExpoView, UIDropInteractionDelegate {
  var dropDisabled = false
  private var reading = false
  let onImage = EventDispatcher()
  let onDropError = EventDispatcher()
  let onDragStateChange = EventDispatcher()
  private let types: [(UTType, String, String)] = [(.jpeg, "image/jpeg", "jpg"), (.png, "image/png", "png"), (.webP, "image/webp", "webp")]

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    addInteraction(UIDropInteraction(delegate: self))
  }

  func dropInteraction(_ interaction: UIDropInteraction, canHandle session: UIDropSession) -> Bool {
    !dropDisabled && !reading && session.hasItemsConforming(toTypeIdentifiers: types.map { $0.0.identifier })
  }

  func dropInteraction(_ interaction: UIDropInteraction, sessionDidEnter session: UIDropSession) {
    onDragStateChange(["active": !dropDisabled])
  }

  func dropInteraction(_ interaction: UIDropInteraction, sessionDidUpdate session: UIDropSession) -> UIDropProposal {
    UIDropProposal(operation: dropDisabled || reading ? .forbidden : .copy)
  }

  func dropInteraction(_ interaction: UIDropInteraction, sessionDidExit session: UIDropSession) { onDragStateChange(["active": false]) }
  func dropInteraction(_ interaction: UIDropInteraction, sessionDidEnd session: UIDropSession) { onDragStateChange(["active": false]) }

  func dropInteraction(_ interaction: UIDropInteraction, performDrop session: UIDropSession) {
    onDragStateChange(["active": false])
    guard !dropDisabled && !reading else { return }
    guard session.items.count == 1 else { onDropError(["message": "Egyszerre egy képet húzz ide."]); return }
    let provider = session.items[0].itemProvider
    guard let type = types.first(where: { provider.hasItemConformingToTypeIdentifier($0.0.identifier) }) else { return }
    reading = true
    provider.loadDataRepresentation(forTypeIdentifier: type.0.identifier) { [weak self] data, error in
      guard let self else { return }
      do {
        guard let data, error == nil, !data.isEmpty else { throw DropError.unreadable }
        guard data.count <= 5 * 1024 * 1024 else { throw DropError.tooLarge }
        let directory = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
        let name = "triton-profile-drop-\(UUID().uuidString).\(type.2)"
        let file = directory.appendingPathComponent(name)
        try data.write(to: file, options: .atomic)
        DispatchQueue.main.async {
          self.reading = false
          self.onImage(["uri": file.absoluteString, "name": name, "mimeType": type.1, "size": data.count, "temporary": true])
        }
      } catch {
        let message = error as? DropError == .tooLarge ? "A kép legfeljebb 5 MB lehet." : "Nem sikerült megnyitni a képet."
        DispatchQueue.main.async { self.reading = false; self.onDropError(["message": message]) }
      }
    }
  }
}

private enum DropError: Error { case unreadable, tooLarge }
