import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';

const completePlayer = createAudioPlayer(require('../assets/sounds/timer_end-soft.mp3'));
const startPlayer = createAudioPlayer(require('../assets/sounds/block_start.caf'));

setAudioModeAsync({
  // The end-of-session chime must land even with the ringer switch off —
  // the whole point of face-down mode is "you'll hear it without looking".
  // Playback category legitimately ignores the silent switch (same as any
  // meditation timer).
  playsInSilentMode: true,
  interruptionMode: 'mixWithOthers',
  shouldPlayInBackground: false,
  allowsRecording: false,
}).catch(() => {});

export const sound = {
  complete: () => {
    try {
      completePlayer.seekTo(0);
      completePlayer.play();
    } catch {}
  },
  // Session start confirmation — the audible channel for when the user
  // can't feel haptics (vibration disabled, phone on soft ground).
  start: () => {
    try {
      startPlayer.seekTo(0);
      startPlayer.play();
    } catch {}
  },
};
