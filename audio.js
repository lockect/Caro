/* =======================================================================
   2. WEB AUDIO API & HAPTIC VIBRATION
   ======================================================================= */
let audioCtx = null;

function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

// Âm thanh gõ cờ lách cách giòn giã (Stone Thud + Snap)
function playStoneSound() {
  if (!soundEnabled) return;
  try {
    initAudio();
    const now = audioCtx.currentTime;

    // Dao động tạo độ trầm ấm của bàn gỗ
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(420, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.07);

    gainNode.gain.setValueAtTime(0.6, now);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.07);

    // Tiếng gõ lách cách góc cạnh (High transient click)
    const clickOsc = audioCtx.createOscillator();
    const clickGain = audioCtx.createGain();
    clickOsc.type = 'sine';
    clickOsc.frequency.setValueAtTime(1400, now);
    clickOsc.frequency.exponentialRampToValueAtTime(300, now + 0.02);

    clickGain.gain.setValueAtTime(0.4, now);
    clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.02);

    clickOsc.connect(clickGain);
    clickGain.connect(audioCtx.destination);
    clickOsc.start(now);
    clickOsc.stop(now + 0.02);
  } catch (e) {
    console.warn('Audio not available', e);
  }
}

// Âm thanh chúc mừng chiến thắng (Fanfare Arpeggio)
function playWinSound() {
  if (!soundEnabled) return;
  try {
    initAudio();
    const notes = [261.63, 329.63, 392.00, 523.25, 659.25]; // C4, E4, G4, C5, E5
    notes.forEach((freq, idx) => {
      const osc = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      const startTime = audioCtx.currentTime + idx * 0.09;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, startTime);
      gainNode.gain.setValueAtTime(0.35, startTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + 0.35);

      osc.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      osc.start(startTime);
      osc.stop(startTime + 0.35);
    });
  } catch (e) {
    console.warn('Audio not available', e);
  }
}

// Bộ rung phản hồi xúc giác điện thoại
function triggerHaptic(duration = 20) {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    try {
      navigator.vibrate(duration);
    } catch (e) {}
  }
}
