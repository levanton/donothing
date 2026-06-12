import { useEffect, useState } from 'react';
import FaceDown from 'face-down';

// Face-down detection for the session ritual ("put me face down").
//
// Backed by our local `face-down` native module — the RAW accelerometer
// through CMMotionManager, which needs no Motion & Fitness permission and
// shows no dialog. The detector itself (sustained entry, hysteresis on
// exit) runs natively; JS only receives lay-down / pick-up transitions.
const ENTER_Z = 0.75;
const EXIT_Z = 0.55;
const HOLD_MS = 600;

export function useFaceDown(enabled: boolean): {
  faceDown: boolean;
  /** False when there's no accelerometer or no native module (simulator,
   *  pre-rebuild dev client) — callers must offer a manual fallback so
   *  nobody gets stuck. */
  available: boolean;
} {
  const [faceDown, setFaceDown] = useState(false);
  const [available] = useState(() => {
    try {
      return FaceDown?.isAvailable() ?? false;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const native = FaceDown;
    if (!enabled || !native) {
      setFaceDown(false);
      return;
    }
    // Sync to the stream's current state (it may already be running for
    // another consumer), then follow transitions.
    try {
      setFaceDown(native.isFaceDown());
    } catch {}
    const sub = native.addListener('onChange', ({ faceDown: down }) => {
      setFaceDown(down);
    });
    native.start(ENTER_Z, EXIT_Z, HOLD_MS);
    return () => {
      sub.remove();
      native.stop();
      setFaceDown(false);
    };
  }, [enabled]);

  return { faceDown: enabled && faceDown, available };
}
