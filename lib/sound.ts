import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';

const completePlayer = createAudioPlayer(require('../assets/sounds/timer_end-soft.mp3'));

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
};
