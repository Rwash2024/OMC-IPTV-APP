// Opening sound, synthesised with Web Audio so the app needs no audio file: a rising whoosh, a soft thump when the
// bar lands, then a warm two-note chime. About 2.4 seconds. Timing matches the animation in Intro.jsx.
export function playIntroSound() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    const t0 = ctx.currentTime + 0.05;

    const master = ctx.createGain();
    master.gain.value = 0.55;
    master.connect(ctx.destination);

    // Whoosh: filtered noise sweeping upward while it swells, then drops away.
    const len = Math.floor(ctx.sampleRate * 1.0);
    const noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 1.1;
    bp.frequency.setValueAtTime(220, t0);
    bp.frequency.exponentialRampToValueAtTime(2600, t0 + 0.8);
    const wg = ctx.createGain();
    wg.gain.setValueAtTime(0.0001, t0);
    wg.gain.exponentialRampToValueAtTime(0.5, t0 + 0.7);
    wg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.95);
    src.connect(bp).connect(wg).connect(master);
    src.start(t0);

    // Thump where the bar lands.
    const tb = t0 + 0.8;
    const thump = ctx.createOscillator();
    const tg = ctx.createGain();
    thump.type = 'sine';
    thump.frequency.setValueAtTime(130, tb);
    thump.frequency.exponentialRampToValueAtTime(42, tb + 0.35);
    tg.gain.setValueAtTime(0.0001, tb);
    tg.gain.exponentialRampToValueAtTime(0.9, tb + 0.02);
    tg.gain.exponentialRampToValueAtTime(0.0001, tb + 0.45);
    thump.connect(tg).connect(master);
    thump.start(tb);
    thump.stop(tb + 0.5);

    // Chime: E5 and B5 with a faint octave on top, long soft decay.
    [[659.25, 0.28], [987.77, 0.2], [1318.5, 0.07]].forEach(([f, peak], i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      const ts = tb + 0.03 + i * 0.04;
      o.type = 'sine';
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, ts);
      g.gain.exponentialRampToValueAtTime(peak, ts + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, ts + 1.5);
      o.connect(g).connect(master);
      o.start(ts);
      o.stop(ts + 1.6);
    });

    setTimeout(() => ctx.close().catch(() => {}), 3500);
  } catch { /* audio is optional */ }
}
