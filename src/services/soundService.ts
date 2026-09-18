// Sound Service for Ennvo Application
// Preloaded Instant-Playback Audio Engine with Zero-Latency & Race-Condition-Free Sound Management

let currentSoundToken = 0;
let activeAudio: HTMLAudioElement | null = null;
let activeAudioCtx: AudioContext | null = null;
let activeRingtoneInterval: any = null;

// Preloaded HTML5 Audio objects for zero latency
const preloadedAudioCache: Record<string, HTMLAudioElement> = {};

const SOUND_PATHS = {
  notification: '/notifecetion.wav',
  ringtone: '/Ringtone.wav',
  calling: '/Calling.wav'
};

// Pre-initialize audio files on module load
if (typeof window !== 'undefined') {
  Object.entries(SOUND_PATHS).forEach(([key, src]) => {
    try {
      const audio = new Audio(src);
      audio.preload = 'auto';
      preloadedAudioCache[key] = audio;
    } catch (e) {
      console.warn(`Failed to preload audio asset ${key}:`, e);
    }
  });
}

/**
 * Stop all active sounds, ringtones, and synthesizers immediately.
 * Guaranteed to stop any pending async HTML5 audio playback.
 */
export const stopCallSounds = () => {
  // Invalidate any ongoing sound request tokens
  currentSoundToken++;

  // Stop Web Audio intervals
  if (activeRingtoneInterval) {
    clearInterval(activeRingtoneInterval);
    activeRingtoneInterval = null;
  }

  // Stop preloaded audio cache
  Object.values(preloadedAudioCache).forEach(audio => {
    try {
      audio.pause();
      audio.currentTime = 0;
    } catch (e) {}
  });

  // Stop any active dynamically created HTML5 Audio
  if (activeAudio) {
    try {
      activeAudio.pause();
      activeAudio.currentTime = 0;
    } catch (e) {}
    activeAudio = null;
  }

  // Suspend and close Web Audio Context
  if (activeAudioCtx) {
    try {
      if (activeAudioCtx.state !== 'closed') {
        activeAudioCtx.suspend();
        activeAudioCtx.close();
      }
    } catch (e) {}
    activeAudioCtx = null;
  }
};

/**
 * Play pre-cached audio file with race-condition prevention token.
 */
const playPreloadedAudio = (
  soundKey: 'notification' | 'ringtone' | 'calling',
  loop: boolean = false,
  volume: number = 0.9
): Promise<void> => {
  stopCallSounds();
  const soundToken = ++currentSoundToken;

  let audio = preloadedAudioCache[soundKey];
  if (!audio) {
    audio = new Audio(SOUND_PATHS[soundKey]);
    audio.preload = 'auto';
    preloadedAudioCache[soundKey] = audio;
  }

  audio.loop = loop;
  audio.volume = volume;
  audio.currentTime = 0;
  activeAudio = audio;

  return new Promise((resolve, reject) => {
    const playPromise = audio.play();

    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          // Check if stopCallSounds() was called while play() was resolving asynchronously!
          if (soundToken !== currentSoundToken) {
            audio.pause();
            audio.currentTime = 0;
            if (activeAudio === audio) activeAudio = null;
            reject(new Error('Sound stopped during playback initiation.'));
          } else {
            resolve();
          }
        })
        .catch(err => {
          if (soundToken === currentSoundToken) {
            reject(err);
          }
        });
    } else {
      if (soundToken !== currentSoundToken) {
        audio.pause();
        audio.currentTime = 0;
        if (activeAudio === audio) activeAudio = null;
        reject(new Error('Sound stopped during playback initiation.'));
      } else {
        resolve();
      }
    }
  });
};

/**
 * Play Notification Sound Effect
 */
export const playNotificationSound = () => {
  playPreloadedAudio('notification', false, 0.85).catch(() => {
    playSynthesizedNotification();
  });
};

/**
 * Play Incoming Call Ringtone
 */
export const playIncomingRingtone = () => {
  const currentToken = currentSoundToken + 1;
  playPreloadedAudio('ringtone', true, 0.95).catch(() => {
    if (currentToken === currentSoundToken) {
      startSynthesizedIncomingRingtone(currentToken);
    }
  });
};

/**
 * Play Outgoing Calling Ringback Sound (Dial Tone)
 */
export const playOutgoingRingtone = () => {
  const currentToken = currentSoundToken + 1;
  playPreloadedAudio('calling', true, 0.85).catch(() => {
    if (currentToken === currentSoundToken) {
      startSynthesizedOutgoingRingtone(currentToken);
    }
  });
};

/**
 * Play Message Sent Sound Effect
 */
let messageSentAudioCtx: AudioContext | null = null;
export const playMessageSentSound = () => {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    if (!messageSentAudioCtx || messageSentAudioCtx.state === 'closed') {
      messageSentAudioCtx = new AudioCtx();
    }
    if (messageSentAudioCtx.state === 'suspended') {
      messageSentAudioCtx.resume().catch(() => {});
    }
    const ctx = messageSentAudioCtx;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(450, now);
    osc.frequency.exponentialRampToValueAtTime(850, now + 0.08);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.1);
  } catch (e) {}
};

/**
 * Synthesized Notification Chime Fallback
 */
const playSynthesizedNotification = () => {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    
    const now = ctx.currentTime;
    const notes = [1046.50, 1318.51, 1567.98];
    notes.forEach((freq, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + index * 0.08);
      
      gain.gain.setValueAtTime(0, now + index * 0.08);
      gain.gain.linearRampToValueAtTime(0.2, now + index * 0.08 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + index * 0.08 + 0.35);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(now + index * 0.08);
      osc.stop(now + index * 0.08 + 0.4);
    });
  } catch (e) {}
};

/**
 * Synthesized Incoming Ringtone Fallback
 */
const startSynthesizedIncomingRingtone = (token: number) => {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    activeAudioCtx = new AudioCtx();

    const playRingtoneCycle = () => {
      if (token !== currentSoundToken || !activeAudioCtx || activeAudioCtx.state === 'closed') return;
      const now = activeAudioCtx.currentTime;

      const sequence = [
        { f1: 880, f2: 1108.73, t: 0 },
        { f1: 987.77, f2: 1318.51, t: 0.18 },
        { f1: 1046.50, f2: 1396.91, t: 0.36 },
        { f1: 1174.66, f2: 1567.98, t: 0.54 },
        
        { f1: 880, f2: 1108.73, t: 0.9 },
        { f1: 987.77, f2: 1318.51, t: 1.08 },
        { f1: 1046.50, f2: 1396.91, t: 1.26 },
        { f1: 1174.66, f2: 1567.98, t: 1.44 }
      ];

      sequence.forEach(step => {
        if (token !== currentSoundToken || !activeAudioCtx || activeAudioCtx.state === 'closed') return;
        const osc1 = activeAudioCtx.createOscillator();
        const osc2 = activeAudioCtx.createOscillator();
        const gain = activeAudioCtx.createGain();

        osc1.type = 'sine';
        osc2.type = 'triangle';

        osc1.frequency.setValueAtTime(step.f1, now + step.t);
        osc2.frequency.setValueAtTime(step.f2, now + step.t);

        gain.gain.setValueAtTime(0, now + step.t);
        gain.gain.linearRampToValueAtTime(0.18, now + step.t + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + step.t + 0.16);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(activeAudioCtx.destination);

        osc1.start(now + step.t);
        osc2.start(now + step.t);
        osc1.stop(now + step.t + 0.18);
        osc2.stop(now + step.t + 0.18);
      });
    };

    activeAudioCtx.resume().catch(() => {});
    activeRingtoneInterval = setInterval(playRingtoneCycle, 2400);
    playRingtoneCycle();
  } catch (e) {
    console.error('Failed to play synthesized ringtone:', e);
  }
};

/**
 * Synthesized Outgoing Dial Tone Fallback
 */
const startSynthesizedOutgoingRingtone = (token: number) => {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    activeAudioCtx = new AudioCtx();

    const playDialTone = () => {
      if (token !== currentSoundToken || !activeAudioCtx || activeAudioCtx.state === 'closed') return;
      const now = activeAudioCtx.currentTime;

      const osc1 = activeAudioCtx.createOscillator();
      const osc2 = activeAudioCtx.createOscillator();
      const gain = activeAudioCtx.createGain();

      osc1.type = 'sine';
      osc2.type = 'sine';

      osc1.frequency.setValueAtTime(440, now);
      osc2.frequency.setValueAtTime(480, now);

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.1, now + 0.1);
      gain.gain.setValueAtTime(0.1, now + 1.8);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.0);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(activeAudioCtx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 2.05);
      osc2.stop(now + 2.05);
    };

    activeAudioCtx.resume().catch(() => {});
    activeRingtoneInterval = setInterval(playDialTone, 3800);
    playDialTone();
  } catch (e) {
    console.error('Failed to play outgoing ringback:', e);
  }
};
