export function createAudio(settings) {
  const state = { audioContext: null, oscillators: new Set() };
  function ensureAudioContext() {
    if (!state.audioContext) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        try { state.audioContext = new AudioContext(); } catch { return null; }
      }
    }

    if (state.audioContext?.state === "suspended") {
      state.audioContext.resume().catch(() => {});
    }

    return state.audioContext;
  }

  function playNote(frequency, startDelay, duration, volume) {
    const context = ensureAudioContext();
    if (!context) {
      return;
    }

    const startAt = context.currentTime + startDelay;
    const oscillator = context.createOscillator();
    state.oscillators.add(oscillator);
    oscillator.onended = () => { state.oscillators.delete(oscillator); oscillator.disconnect(); };
    const gain = context.createGain();

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, startAt);
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(volume, startAt + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(startAt);
    oscillator.stop(startAt + duration + 0.03);
  }

  function playTone(kind, firstTry = false) {
    if (!settings.sound) {
      return;
    }

    if (kind === "badge") {
      playNote(523.25, 0, 0.18, 0.055);
      playNote(659.25, 0.11, 0.2, 0.055);
      playNote(783.99, 0.22, 0.22, 0.06);
      playNote(1046.5, 0.35, 0.32, 0.06);
      return;
    }

    if (kind === "correct") {
      playNote(523.25, 0, 0.17, 0.065);
      playNote(659.25, 0.1, 0.2, 0.06);
      playNote(firstTry ? 783.99 : 698.46, 0.21, firstTry ? 0.26 : 0.2, firstTry ? 0.065 : 0.05);
      return;
    }

    playNote(196, 0, 0.14, 0.045);
  }


  return {
    play: playTone,
    stop() {
      for (const oscillator of state.oscillators) {
        try { oscillator.stop(); oscillator.disconnect(); } catch { /* Already ended. */ }
      }
      state.oscillators.clear();
    },
  };
}
