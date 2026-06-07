import { useCallback } from 'react';

const SOUNDS = {
  WHOOSH: 'https://assets.mixkit.co/sfx/preview/mixkit-fast-whoosh-1185.mp3',
  SUCCESS: 'https://assets.mixkit.co/sfx/preview/mixkit-winning-chime-2064.mp3',
  HOLOGRAM: 'https://assets.mixkit.co/sfx/preview/mixkit-futuristic-technology-notification-2584.mp3',
  CYBER_CLEAR: 'https://assets.mixkit.co/sfx/preview/mixkit-futuristic-robotic-voice-notification-2454.mp3',
};

export function useSound() {
  const playSound = useCallback((soundName: keyof typeof SOUNDS) => {
    const audio = new Audio(SOUNDS[soundName]);
    audio.volume = 0.5;
    audio.play().catch(err => console.log('Audio play blocked:', err));
  }, []);

  return { playSound };
}
