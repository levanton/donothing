import ExpoModulesCore
import CoreHaptics

// Plays a true *continuous* haptic via Core Haptics — one sustained vibration
// whose intensity swells up and breathes back down, the way expo-haptics
// (discrete impacts only) fundamentally can't. This is what apps like Opal use
// for a satisfying end-of-session buzz.
@available(iOS 15.0, *)
public class CoreHapticsModule: Module {
  private var engine: CHHapticEngine?
  // Keep the running player alive until it finishes — a local var could
  // deallocate mid-playback.
  private var player: CHHapticPatternPlayer?

  public func definition() -> ModuleDefinition {
    Name("CoreHaptics")

    Function("isSupported") { () -> Bool in
      CHHapticEngine.capabilitiesForHardware().supportsHaptics
    }

    // duration: total length in seconds. intensity: 0…1 peak strength.
    AsyncFunction("playSwell") { (duration: Double?, intensity: Double?) in
      try self.playSwell(duration: duration ?? 1.3, peak: Float(intensity ?? 1.0))
    }
  }

  private func ensureEngine() throws {
    if engine == nil {
      let e = try CHHapticEngine()
      e.isAutoShutdownEnabled = true
      // iOS can reset/stop the engine (interruptions, idle) — restart on demand.
      e.resetHandler = { [weak e] in try? e?.start() }
      engine = e
    }
    try engine?.start()
  }

  private func playSwell(duration: Double, peak: Float) throws {
    guard CHHapticEngine.capabilitiesForHardware().supportsHaptics else { return }
    try ensureEngine()
    guard let engine = engine else { return }

    let p = max(0.0, min(1.0, peak))

    // One sustained event. Its intensity/sharpness are driven by the curves below.
    let event = CHHapticEvent(
      eventType: .hapticContinuous,
      parameters: [
        CHHapticEventParameter(parameterID: .hapticIntensity, value: p),
        CHHapticEventParameter(parameterID: .hapticSharpness, value: 0.3),
      ],
      relativeTime: 0,
      duration: duration
    )

    // Bell-shaped amplitude: ease in (~0→1 over first ~30%), hold near peak,
    // then a long gentle fade to silence. This is the "swell".
    let intensityCurve = CHHapticParameterCurve(
      parameterID: .hapticIntensityControl,
      controlPoints: [
        CHHapticParameterCurve.ControlPoint(relativeTime: 0,               value: 0.0),
        CHHapticParameterCurve.ControlPoint(relativeTime: duration * 0.30, value: 1.0),
        CHHapticParameterCurve.ControlPoint(relativeTime: duration * 0.60, value: 0.85),
        CHHapticParameterCurve.ControlPoint(relativeTime: duration,        value: 0.0),
      ],
      relativeTime: 0
    )

    // Soft and round at the edges, a touch brighter through the middle — adds
    // life without ever feeling like a hard knock.
    let sharpnessCurve = CHHapticParameterCurve(
      parameterID: .hapticSharpnessControl,
      controlPoints: [
        CHHapticParameterCurve.ControlPoint(relativeTime: 0,               value: -0.5),
        CHHapticParameterCurve.ControlPoint(relativeTime: duration * 0.50, value: 0.2),
        CHHapticParameterCurve.ControlPoint(relativeTime: duration,        value: -0.4),
      ],
      relativeTime: 0
    )

    let pattern = try CHHapticPattern(
      events: [event],
      parameterCurves: [intensityCurve, sharpnessCurve]
    )
    let player = try engine.makePlayer(with: pattern)
    self.player = player
    try player.start(atTime: CHHapticTimeImmediate)
  }
}
