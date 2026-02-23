/**
 * InstaPoll Alert — Offscreen Audio
 * Plays a repeating synthesized chime using the Web Audio API.
 * This runs in an offscreen document because MV3 service workers
 * cannot access the AudioContext API.
 */

let chimeInterval = null;
let activeCtx = null;

function playChimeOnce() {
  const ctx = new AudioContext();
  activeCtx = ctx;
  const now = ctx.currentTime;

  // Create an urgent, attention-grabbing three-tone chime
  const notes = [
    { freq: 880, delay: 0 },      // A5
    { freq: 1108.73, delay: 0.12 }, // C#6
    { freq: 1318.51, delay: 0.24 }, // E6  — major triad
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

  // Clean up after playback
  setTimeout(() => {
    try { ctx.close(); } catch (e) { /* already closed */ }
  }, 1500);
}

function startRepeatingChime() {
  // Play immediately
  playChimeOnce();

  // Then repeat every 5 seconds
  if (chimeInterval) clearInterval(chimeInterval);
  chimeInterval = setInterval(() => {
    playChimeOnce();
  }, 5000);
}

function stopRepeatingChime() {
  if (chimeInterval) {
    clearInterval(chimeInterval);
    chimeInterval = null;
  }
  // Stop any active audio context
  if (activeCtx) {
    try { activeCtx.close(); } catch (e) { /* already closed */ }
    activeCtx = null;
  }
}

// Listen for messages from the background worker
chrome.runtime.onMessage.addListener((message) => {
  switch (message.type) {
    case "PLAY_CHIME":
      startRepeatingChime();
      break;
    case "STOP_CHIME":
      stopRepeatingChime();
      break;
  }
});
