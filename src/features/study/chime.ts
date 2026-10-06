const KEY = 'ss.chime';

export function chimeEnabled(): boolean {
  try { return localStorage.getItem(KEY) === '1'; } catch { return false; }
}

export function setChimeEnabled(on: boolean) {
  try { localStorage.setItem(KEY, on ? '1' : '0'); } catch { /* storage unavailable */ }
}

let ctx: AudioContext | null = null;

/** Two soft sine notes (660 Hz → 880 Hz). Silent if audio is unavailable or blocked. */
export function playChime() {
  try {
    ctx ??= new AudioContext();
    const t0 = ctx.currentTime;
    [660, 880].forEach((freq, i) => {
      const osc = ctx!.createOscillator();
      const gain = ctx!.createGain();
      const start = t0 + i * 0.14;
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.08, start + 0.02);
      gain.gain.linearRampToValueAtTime(0, start + 0.12);
      osc.connect(gain).connect(ctx!.destination);
      osc.start(start);
      osc.stop(start + 0.13);
    });
  } catch { /* no audio */ }
}
