import ExpoModulesCore
import CoreMotion

// Face-down detection on the RAW accelerometer. CMMotionManager's
// accelerometer stream is not gated by the Motion & Fitness permission, so
// no dialog ever appears (that permission guards activity/pedometer data).
//
// The whole detector lives here: entering face-down requires the reading to
// stay past `enterZ` for `holdMs` (so flips and fumbling never trigger), and
// leaving uses the lower `exitZ` (hysteresis — table wobble can't flicker
// the state). JS receives only the transitions.
//
// iOS convention: lying face UP reads z ≈ -1, face DOWN reads z ≈ +1.
public class FaceDownModule: Module {
  private let manager = CMMotionManager()
  private let queue = OperationQueue()
  // Multiple JS hooks may overlap (the start gate, the pause sheet, the
  // running watcher) — refcount so one consumer stopping doesn't kill the
  // stream for the others.
  private var clients = 0
  private var isDown = false
  private var candidateSince: Date?

  public func definition() -> ModuleDefinition {
    Name("FaceDown")

    Events("onChange")

    Function("isAvailable") { () -> Bool in
      self.manager.isAccelerometerAvailable
    }

    Function("isFaceDown") { () -> Bool in
      self.isDown
    }

    Function("start") { (enterZ: Double, exitZ: Double, holdMs: Double) in
      self.clients += 1
      guard self.clients == 1 else { return }
      guard self.manager.isAccelerometerAvailable else { return }
      self.isDown = false
      self.candidateSince = nil
      self.queue.maxConcurrentOperationCount = 1
      self.manager.accelerometerUpdateInterval = 0.1
      self.manager.startAccelerometerUpdates(to: self.queue) { data, _ in
        guard let z = data?.acceleration.z else { return }
        if self.isDown {
          if z < exitZ {
            self.isDown = false
            self.candidateSince = nil
            self.sendEvent("onChange", ["faceDown": false])
          }
        } else if z > enterZ {
          if self.candidateSince == nil {
            self.candidateSince = Date()
          } else if Date().timeIntervalSince(self.candidateSince!) * 1000 >= holdMs {
            self.isDown = true
            self.sendEvent("onChange", ["faceDown": true])
          }
        } else {
          self.candidateSince = nil
        }
      }
    }

    Function("stop") {
      self.clients = max(0, self.clients - 1)
      guard self.clients == 0 else { return }
      self.manager.stopAccelerometerUpdates()
      self.isDown = false
      self.candidateSince = nil
    }
  }
}
