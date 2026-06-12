import ExpoModulesCore
import AVFoundation

// Drives the camera torch directly through AVCaptureDevice. Torch-only use
// needs NO camera permission and no capture session — we lock the device,
// set the level, unlock. Used to blink the flash at session end while the
// phone lies face down (the torch points up off the table).
public class TorchModule: Module {
  public func definition() -> ModuleDefinition {
    Name("Torch")

    Function("isAvailable") { () -> Bool in
      AVCaptureDevice.default(for: .video)?.hasTorch ?? false
    }

    // level: 0 turns the torch off; 0…1 sets brightness.
    Function("setTorch") { (level: Double) in
      guard let device = AVCaptureDevice.default(for: .video), device.hasTorch else {
        return
      }
      do {
        try device.lockForConfiguration()
        if level <= 0 {
          device.torchMode = .off
        } else {
          try device.setTorchModeOn(level: Float(min(level, 1)))
        }
        device.unlockForConfiguration()
      } catch {
        // Torch is best-effort — never throw into JS.
      }
    }
  }
}
