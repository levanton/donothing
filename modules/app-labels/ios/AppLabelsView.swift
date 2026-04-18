import Combine
import ExpoModulesCore
import FamilyControls
import ManagedSettings
import SwiftUI
import UIKit

private let FAMILY_ACTIVITY_SELECTION_ID_KEY = "familyActivitySelectionIds"

private func resolveAppGroup() -> String? {
  return Bundle.main.object(forInfoDictionaryKey: "REACT_NATIVE_DEVICE_ACTIVITY_APP_GROUP")
    as? String
}

private func loadSelection(id: String) -> FamilyActivitySelection? {
  guard let suite = resolveAppGroup(),
        let defaults = UserDefaults(suiteName: suite),
        let map = defaults.dictionary(forKey: FAMILY_ACTIVITY_SELECTION_ID_KEY),
        let base64 = map[id] as? String,
        let data = Data(base64Encoded: base64) else {
    return nil
  }
  return try? JSONDecoder().decode(FamilyActivitySelection.self, from: data)
}

@available(iOS 15.2, *)
enum AnyActivityToken: Hashable {
  case app(ApplicationToken)
  case category(ActivityCategoryToken)
  case web(WebDomainToken)
}

@available(iOS 15.2, *)
struct TokenIcon: View {
  let token: AnyActivityToken
  let size: CGFloat
  let tint: Color

  var body: some View {
    // Render at natural font size — no .frame() so there's no transparent
    // padding around the icon when laid out in HStack.
    Group {
      switch token {
      case .app(let t):
        Label(t).labelStyle(IconOnlyLabelStyle())
      case .category(let t):
        Label(t).labelStyle(IconOnlyLabelStyle())
      case .web(let t):
        Label(t).labelStyle(IconOnlyLabelStyle())
      }
    }
    .font(.system(size: size))
    .foregroundColor(tint)
  }
}

@available(iOS 15.2, *)
struct TokenRow: View {
  let token: AnyActivityToken
  let iconSize: CGFloat
  let tint: Color

  var body: some View {
    HStack(spacing: 14) {
      Group {
        switch token {
        case .app(let t): Label(t)
        case .category(let t): Label(t)
        case .web(let t): Label(t)
        }
      }
      .labelStyle(.titleAndIcon)
      .font(.system(size: 16))
      .foregroundColor(tint)
      .lineLimit(1)
      .truncationMode(.tail)
      Spacer(minLength: 0)
    }
    .padding(.vertical, 10)
    .padding(.horizontal, 4)
  }
}

@available(iOS 15.0, *)
final class AppLabelsModel: ObservableObject {
  @Published var selection: FamilyActivitySelection = FamilyActivitySelection()
  @Published var iconSize: CGFloat = 32
  @Published var maxItems: Int = 0       // 0 = unlimited
  @Published var overlap: CGFloat = 0    // pixels
  @Published var layout: String = "row"  // "row" | "grid"
  var selectionId: String? {
    didSet { reload() }
  }

  func reload() {
    guard let id = selectionId, let s = loadSelection(id: id) else {
      selection = FamilyActivitySelection()
      return
    }
    selection = s
  }
}

@available(iOS 15.2, *)
struct AppLabelsContent: View {
  @ObservedObject var model: AppLabelsModel
  var tint: Color
  var ringColor: Color

  private var allTokens: [AnyActivityToken] {
    var out: [AnyActivityToken] = []
    out.reserveCapacity(
      model.selection.applicationTokens.count
      + model.selection.categoryTokens.count
      + model.selection.webDomainTokens.count
    )
    out.append(contentsOf: model.selection.applicationTokens.map { .app($0) })
    out.append(contentsOf: model.selection.categoryTokens.map { .category($0) })
    out.append(contentsOf: model.selection.webDomainTokens.map { .web($0) })
    return out
  }

  var body: some View {
    let tokens = allTokens
    let limit = model.maxItems > 0 ? min(tokens.count, model.maxItems) : tokens.count
    let displayed = Array(tokens.prefix(limit))
    let remaining = tokens.count - displayed.count

    switch model.layout {
    case "list":
      listBody(displayed: displayed, remaining: remaining)
    case "grid":
      gridBody(displayed: displayed, remaining: remaining)
    default:
      rowBody(displayed: displayed, remaining: remaining)
    }
  }

  @ViewBuilder
  private func listBody(displayed: [AnyActivityToken], remaining: Int) -> some View {
    ScrollView(showsIndicators: false) {
      LazyVStack(spacing: 0) {
        ForEach(Array(displayed.enumerated()), id: \.offset) { idx, token in
          TokenRow(token: token, iconSize: model.iconSize, tint: tint)
          if idx < displayed.count - 1 {
            Rectangle()
              .fill(Color.secondary.opacity(0.18))
              .frame(height: 0.5)
          }
        }
        if remaining > 0 {
          HStack {
            Text("+\(remaining) more")
              .font(.system(size: 14, weight: .medium))
              .foregroundColor(tint.opacity(0.7))
            Spacer()
          }
          .padding(.vertical, 10)
          .padding(.horizontal, 4)
        }
      }
    }
  }

  @ViewBuilder
  private func rowBody(displayed: [AnyActivityToken], remaining: Int) -> some View {
    HStack(spacing: -model.overlap) {
      ForEach(Array(displayed.enumerated()), id: \.offset) { _, token in
        TokenIcon(token: token, size: model.iconSize, tint: tint)
      }
      if remaining > 0 {
        Text("+\(remaining)")
          .font(.system(size: model.iconSize * 0.38, weight: .semibold))
          .foregroundColor(tint)
          .frame(width: model.iconSize, height: model.iconSize)
      }
    }
    .frame(height: model.iconSize, alignment: .leading)
    .frame(maxWidth: .infinity, alignment: .leading)
  }

  @ViewBuilder
  private func gridBody(displayed: [AnyActivityToken], remaining: Int) -> some View {
    // Adaptive grid — columns size themselves to the icon, so iconSize from
    // JS controls the actual rendered size rather than being squashed by a
    // fixed column count.
    let columns = [GridItem(.adaptive(minimum: model.iconSize + 4), spacing: 16)]
    LazyVGrid(columns: columns, alignment: .leading, spacing: 20) {
      ForEach(Array(displayed.enumerated()), id: \.offset) { _, token in
        TokenIcon(token: token, size: model.iconSize, tint: tint)
      }
      if remaining > 0 {
        Text("+\(remaining)")
          .font(.system(size: model.iconSize * 0.38, weight: .semibold))
          .foregroundColor(tint)
          .frame(width: model.iconSize, height: model.iconSize)
      }
    }
    .padding(.vertical, 4)
  }
}

struct AppLabelsUnsupported: View {
  var body: some View {
    Text("iOS 15.2+ required")
      .font(.caption2)
      .foregroundColor(.secondary)
  }
}

@available(iOS 15.0, *)
class AppLabelsView: ExpoView {
  let model = AppLabelsModel()
  private var hostController: UIViewController!
  private var tintHex: String?
  private var ringHex: String?

  private var defaultsObserver: NSObjectProtocol?

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    clipsToBounds = true
    backgroundColor = .clear

    rebuildHost()

    defaultsObserver = NotificationCenter.default.addObserver(
      forName: UserDefaults.didChangeNotification,
      object: nil,
      queue: .main
    ) { [weak self] _ in
      self?.model.reload()
    }
  }

  deinit {
    if let obs = defaultsObserver {
      NotificationCenter.default.removeObserver(obs)
    }
  }

  private func rebuildHost() {
    if let old = hostController {
      old.willMove(toParent: nil)
      old.view.removeFromSuperview()
      old.removeFromParent()
    }
    let tint = tintHex.flatMap(uiColor(fromHex:)).map(Color.init) ?? .primary
    let ring = ringHex.flatMap(uiColor(fromHex:)).map(Color.init) ?? Color(.systemBackground)

    if #available(iOS 15.2, *) {
      let host = UIHostingController(
        rootView: AppLabelsContent(model: model, tint: tint, ringColor: ring)
      )
      host.view.backgroundColor = .clear
      addSubview(host.view)
      hostController = host
    } else {
      let host = UIHostingController(rootView: AppLabelsUnsupported())
      host.view.backgroundColor = .clear
      addSubview(host.view)
      hostController = host
    }
  }

  override func layoutSubviews() {
    hostController?.view.frame = bounds
  }

  override func didMoveToWindow() {
    super.didMoveToWindow()
    if window != nil {
      if let host = hostController, host.parent == nil, let parent = parentViewController {
        parent.addChild(host)
        host.didMove(toParent: parent)
      }
      model.reload()
    } else if let host = hostController, host.parent != nil {
      host.willMove(toParent: nil)
      host.removeFromParent()
    }
  }

  private var parentViewController: UIViewController? {
    var responder: UIResponder? = self
    while let next = responder?.next {
      if let vc = next as? UIViewController { return vc }
      responder = next
    }
    return nil
  }

  func setTint(hex: String?) {
    tintHex = hex
    rebuildHost()
  }

  func setRing(hex: String?) {
    ringHex = hex
    rebuildHost()
  }
}

private func uiColor(fromHex hex: String) -> UIColor? {
  var s = hex.trimmingCharacters(in: .whitespacesAndNewlines)
  if s.hasPrefix("#") { s.removeFirst() }
  guard s.count == 6 || s.count == 8 else { return nil }
  var rgba: UInt64 = 0
  guard Scanner(string: s).scanHexInt64(&rgba) else { return nil }
  let r, g, b, a: CGFloat
  if s.count == 8 {
    r = CGFloat((rgba & 0xFF00_0000) >> 24) / 255
    g = CGFloat((rgba & 0x00FF_0000) >> 16) / 255
    b = CGFloat((rgba & 0x0000_FF00) >> 8) / 255
    a = CGFloat(rgba & 0x0000_00FF) / 255
  } else {
    r = CGFloat((rgba & 0xFF_0000) >> 16) / 255
    g = CGFloat((rgba & 0x00_FF00) >> 8) / 255
    b = CGFloat(rgba & 0x00_00FF) / 255
    a = 1
  }
  return UIColor(red: r, green: g, blue: b, alpha: a)
}
