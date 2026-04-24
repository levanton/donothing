import ExpoModulesCore

@available(iOS 15.0, *)
public class AppLabelsViewModule: Module {
  public func definition() -> ModuleDefinition {
    Name("AppLabelsViewModule")

    View(AppLabelsView.self) {
      Prop("activitySelectionId") { (view: AppLabelsView, id: String?) in
        view.model.selectionId = id
      }
      Prop("iconSize") { (view: AppLabelsView, size: Double?) in
        view.model.iconSize = CGFloat(size ?? 32)
        view.model.reload()
      }
      Prop("maxItems") { (view: AppLabelsView, n: Int?) in
        view.model.maxItems = n ?? 0
      }
      Prop("overlap") { (view: AppLabelsView, px: Double?) in
        view.model.overlap = CGFloat(px ?? 0)
      }
      Prop("layout") { (view: AppLabelsView, s: String?) in
        view.model.layout = s ?? "row"
      }
      Prop("tintColor") { (view: AppLabelsView, hex: String?) in
        view.setTint(hex: hex)
      }
      Prop("ringColor") { (view: AppLabelsView, hex: String?) in
        view.setRing(hex: hex)
      }

      AsyncFunction("reload") { (view: AppLabelsView) in
        view.model.reload()
      }
    }
  }
}
