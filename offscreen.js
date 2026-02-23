let chimeInterval = null;
let activeCtx = null;

function playChimeOnce() {
  const ctx = new AudioContext();
  activeCtx = ctx;
  const now = ctx.currentTime;

  const notes = [
    { freq: 880, delay: 0 },
    { freq: 1108.73, delay: 0.12 },
    { freq: 1318.51, delay: 0.24 },
  ];

  notes.forEach(({ freq, delay }) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, now);
    osc.connect(gain);
    gain.connect(ctx.destination);

    const t = now + delay;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.35, t + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);

    osc.start(t);
    osc.stop(t + 0.6);
  });

  setTimeout(() => {
    if (ctx.state !== "closed") ctx.close().catch(() => { });
  }, 1500);
}

function startRepeatingChime() {
  playChimeOnce();
  if (chimeInterval) clearInterval(chimeInterval);
  chimeInterval = setInterval(playChimeOnce, 5000);
}

function stopRepeatingChime() {
  if (chimeInterval) {
    clearInterval(chimeInterval);
    chimeInterval = null;
  }
  if (activeCtx) {
    if (activeCtx.state !== "closed") activeCtx.close().catch(() => { });
    activeCtx = null;
  }
}

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "PLAY_CHIME") startRepeatingChime();
  else if (message.type === "STOP_CHIME") stopRepeatingChime();
});
