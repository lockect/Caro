/* =======================================================================
   6. UI INTERACTION & INPUT CONTROLS
   ======================================================================= */
function getCellFromCoords(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const x = clientX - rect.left;
  const y = clientY - rect.top;

  const c = Math.round((x - boardOffset) / cellSize);
  const r = Math.round((y - boardOffset) / cellSize);

  if (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE) {
    return { r, c };
  }
  return null;
}

// Sự kiện chuột trên máy tính (Hover & Click)
canvas.addEventListener('mousemove', (e) => {
  if (gameOver || isAiThinking) return;
  const cell = getCellFromCoords(e.clientX, e.clientY);
  if (cell && (hoveredCell?.r !== cell.r || hoveredCell?.c !== cell.c)) {
    hoveredCell = cell;
    render();
  }
});

canvas.addEventListener('mouseleave', () => {
  if (hoveredCell) {
    hoveredCell = null;
    render();
  }
});

canvas.addEventListener('click', (e) => {
  initAudio();
  if (gameOver || isAiThinking) return;
  const cell = getCellFromCoords(e.clientX, e.clientY);
  if (cell) {
    makeMove(cell.r, cell.c);
  }
});

// Sự kiện cảm ứng mượt mà trên điện thoại
canvas.addEventListener('touchstart', (e) => {
  initAudio();
  if (gameOver || isAiThinking || e.touches.length > 1) return;
  e.preventDefault();
  const touch = e.touches[0];
  const cell = getCellFromCoords(touch.clientX, touch.clientY);
  if (cell) {
    hoveredCell = cell;
    render();
  }
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
  if (gameOver || isAiThinking || e.touches.length > 1) return;
  e.preventDefault();
  const touch = e.touches[0];
  const cell = getCellFromCoords(touch.clientX, touch.clientY);
  if (cell && (hoveredCell?.r !== cell.r || hoveredCell?.c !== cell.c)) {
    hoveredCell = cell;
    render();
  }
}, { passive: false });

canvas.addEventListener('touchend', (e) => {
  if (gameOver || isAiThinking) return;
  e.preventDefault();
  if (hoveredCell) {
    makeMove(hoveredCell.r, hoveredCell.c);
    hoveredCell = null;
  }
});

// Controls & Modals
document.getElementById('btnUndo').addEventListener('click', undoMove);
document.getElementById('btnNewGame').addEventListener('click', resetGame);
document.getElementById('btnModalNewGame').addEventListener('click', resetGame);
document.getElementById('btnModalCloseReview').addEventListener('click', () => {
  document.getElementById('winModal').classList.add('hidden');
});

// Bật/tắt âm thanh
document.getElementById('btnSoundToggle').addEventListener('click', () => {
  soundEnabled = !soundEnabled;
  document.getElementById('iconSoundOn').classList.toggle('hidden', !soundEnabled);
  document.getElementById('iconSoundOff').classList.toggle('hidden', soundEnabled);
});

// Mở / Đóng Hộp Thoại Cài Đặt
const settingsModal = document.getElementById('settingsModal');
document.getElementById('btnSettingsToggle').addEventListener('click', () => {
  settingsModal.classList.remove('hidden');
});
document.getElementById('btnCloseSettings').addEventListener('click', () => {
  settingsModal.classList.add('hidden');
});

// Lựa chọn Mode
const btnModePvE = document.getElementById('btnModePvE');
const btnModePvP = document.getElementById('btnModePvP');
const btnModeBlitz = document.getElementById('btnModeBlitz');
const btnModeTower = document.getElementById('btnModeTower');
const btnModePuzzle = document.getElementById('btnModePuzzle');
const aiLevelSection = document.getElementById('aiLevelSection');
const playerSideSection = document.getElementById('playerSideSection');

function setActiveModeButton(activeBtn) {
  [btnModePvE, btnModePvP, btnModeBlitz, btnModeTower, btnModePuzzle].forEach(b => {
    if (b) b.className = 'btn-mode py-1.5 rounded-lg text-slate-400 hover:text-white';
  });
  if (activeBtn === btnModePuzzle) {
    activeBtn.className = 'btn-mode col-span-2 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-bold shadow';
  } else if (activeBtn) {
    activeBtn.className = 'btn-mode py-1.5 rounded-lg bg-amber-500 text-slate-950 font-bold shadow';
  }
}

btnModePvE.addEventListener('click', () => {
  gameMode = 'pve';
  setActiveModeButton(btnModePvE);
  aiLevelSection.classList.remove('hidden');
  playerSideSection.classList.remove('hidden');
});

btnModePvP.addEventListener('click', () => {
  gameMode = 'pvp';
  setActiveModeButton(btnModePvP);
  aiLevelSection.classList.add('hidden');
  playerSideSection.classList.add('hidden');
});

btnModeBlitz.addEventListener('click', () => {
  gameMode = 'blitz';
  setActiveModeButton(btnModeBlitz);
  aiLevelSection.classList.remove('hidden');
  playerSideSection.classList.remove('hidden');
});

btnModeTower.addEventListener('click', () => {
  gameMode = 'tower';
  setActiveModeButton(btnModeTower);
  aiLevelSection.classList.add('hidden');
  playerSideSection.classList.add('hidden');
});

btnModePuzzle.addEventListener('click', () => {
  gameMode = 'puzzle';
  setActiveModeButton(btnModePuzzle);
  aiLevelSection.classList.add('hidden');
  playerSideSection.classList.add('hidden');
});

// Nút Gợi ý bài tập
document.getElementById('btnHintPuzzle').addEventListener('click', () => {
  if (gameMode === 'puzzle') {
    const puz = PUZZLES[currentPuzzleIndex];
    alert(`💡 GỢI Ý [${puz.title}]:\n\n${puz.hint}`);
  }
});

// Lựa chọn độ khó AI
document.querySelectorAll('.btn-diff').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.btn-diff').forEach(b => {
      b.className = 'btn-diff py-1.5 text-[10px] font-medium rounded-lg text-slate-400';
    });
    btn.className = 'btn-diff py-1.5 text-[10px] font-bold rounded-lg bg-amber-500 text-slate-950 shadow';
    aiDifficulty = btn.getAttribute('data-diff');
  });
});

// Lựa chọn quân của người chơi
const btnPickX = document.getElementById('btnPickX');
const btnPickO = document.getElementById('btnPickO');

btnPickX.addEventListener('click', () => {
  humanSide = PLAYER_X;
  btnPickX.className = 'py-2 text-xs font-bold rounded-lg bg-cyan-600 text-white';
  btnPickO.className = 'py-2 text-xs font-bold rounded-lg text-slate-400 hover:text-white';
});

btnPickO.addEventListener('click', () => {
  humanSide = PLAYER_O;
  btnPickO.className = 'py-2 text-xs font-bold rounded-lg bg-rose-600 text-white';
  btnPickX.className = 'py-2 text-xs font-bold rounded-lg text-slate-400 hover:text-white';
});

// Áp dụng thiết lập mới
document.getElementById('btnApplySettings').addEventListener('click', () => {
  settingsModal.classList.add('hidden');
  score = { X: 0, O: 0, draws: 0 };
  document.getElementById('scoreX').innerText = '0';
  document.getElementById('scoreO').innerText = '0';
  resetGame();
});

/* Window Resize & Load Initialization */
window.addEventListener('resize', () => {
  resizeCanvas();
});

if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', () => {
    resizeCanvas();
  });
}

window.addEventListener('load', () => {
  resizeCanvas();
  resetGame();
});
