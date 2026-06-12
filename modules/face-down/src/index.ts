import { requireOptionalNativeModule } from 'expo-modules-core';

export interface FaceDownChangeEvent {
  faceDown: boolean;
}

interface FaceDownNativeModule {
  isAvailable(): boolean;
  isFaceDown(): boolean;
  start(enterZ: number, exitZ: number, holdMs: number): void;
  stop(): void;
  // Provided by the native module's EventEmitter base at runtime.
  addListener(
    eventName: 'onChange',
    listener: (event: FaceDownChangeEvent) => void,
  ): { remove(): void };
}

// Optional: null until the native module is compiled into the build, so JS
// keeps working in the simulator / before the next native build.
const Native = requireOptionalNativeModule<FaceDownNativeModule>('FaceDown');

export default Native;
