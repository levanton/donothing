import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';

const completePlayer = createAudioPlayer(require('../assets/sounds/timer_end.caf'));
const blockStartPlayer = createAudioPlayer(require('../assets/sounds/block_start.caf'));

setAudioModeAsync({
  playsInSilentMode: false,
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
  blockStart: () => {
    try {
      blockStartPlayer.seekTo(0);
      blockStartPlayer.play();
    } catch {}
  },
};
