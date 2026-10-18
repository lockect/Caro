/* =======================================================================
   5. GAMEPLAY LOGIC & ACTIONS
   ======================================================================= */
function checkWin(r, c, player) {
  for (const [dr, dc] of DIRECTIONS) {
    const line = [{ r, c }];

    let step = 1;
    while (true) {
      const nr = r + dr * step;
      const nc = c + dc * step;
      if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE && board[nr][nc] === player) {
        line.push({ r: nr, c: nc });
        step++;
      } else break;
    }

    step = 1;
    while (true) {
      const nr = r - dr * step;
      const nc = c - dc * step;
      if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE && board[nr][nc] === player) {
        line.unshift({ r: nr, c: nc });
        step++;
      } else break;
    }

    if (line.length >= 5) {
      return line;
    }
  }
  return null;
}

function isBoardFull() {
  return moveHistory.length >= BOARD_SIZE * BOARD_SIZE;
}

function makeMove(r, c) {
  if (board[r][c] !== EMPTY || gameOver || isAiThinking) return false;

  board[r][c] = currentPlayer;
  moveHistory.push({ r, c, player: currentPlayer });

  playStoneSound();
  triggerHaptic(18);

  document.getElementById('moveCountText').innerText = moveHistory.length;
  document.getElementById('btnUndo').disabled = (moveHistory.length === 0);

  const winResult = checkWin(r, c, currentPlayer);
  if (winResult) {
    gameOver = true;
    winningLine = winResult;
    clearInterval(blitzTimer);
    render();
    handleGameOver(currentPlayer);
    return true;
  }

  if (isBoardFull()) {
    gameOver = true;
    clearInterval(blitzTimer);
    render();
    handleGameOver(0);
    return true;
  }

  currentPlayer = (currentPlayer === PLAYER_X) ? PLAYER_O : PLAYER_X;
  updateTurnUI();
  render();

  if (gameMode === 'blitz') {
    startBlitzTimer();
  }

  if ((gameMode === 'pve' || gameMode === 'tower' || (gameMode === 'blitz' && currentPlayer !== humanSide)) && currentPlayer !== humanSide && !gameOver) {
    triggerAiTurn();
  }

  return true;
}

function startBlitzTimer() {
  clearInterval(blitzTimer);
  if (gameMode !== 'blitz' || gameOver) return;

  blitzTimeLeft = 10;
  updateModeBanner();

  blitzTimer = setInterval(() => {
    blitzTimeLeft--;
    updateModeBanner();

    if (blitzTimeLeft <= 0) {
      clearInterval(blitzTimer);
      playStoneSound();
      triggerHaptic(40);
      makeRandomBlitzMove();
    }
  }, 1000);
}

function makeRandomBlitzMove() {
  if (gameOver) return;
  const emptyCells = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c] === EMPTY) emptyCells.push({ r, c });
    }
  }
  if (emptyCells.length > 0) {
    const pick = emptyCells[Math.floor(Math.random() * emptyCells.length)];
    makeMove(pick.r, pick.c);
  }
}

function updateModeBanner() {
  const banner = document.getElementById('modeBannerBadge');
  const text = document.getElementById('modeBannerText');
  const btnHint = document.getElementById('btnHintPuzzle');

  if (gameMode === 'blitz') {
    banner.classList.remove('hidden');
    btnHint.classList.add('hidden');
    text.innerHTML = `⏱️ Lượt đi: <span class="${blitzTimeLeft <= 3 ? 'text-rose-400 animate-pulse font-black text-sm' : 'text-amber-300'}">${blitzTimeLeft}s</span>`;
  } else if (gameMode === 'tower') {
    banner.classList.remove('hidden');
    btnHint.classList.add('hidden');
    const stg = TOWER_STAGES[currentTowerStage - 1];
    text.innerText = `🏰 ${stg.bossName}`;
  } else if (gameMode === 'puzzle') {
    banner.classList.remove('hidden');
    btnHint.classList.remove('hidden');
    const puz = PUZZLES[currentPuzzleIndex];
    text.innerText = `🧩 ${puz.title}`;
  } else {
    banner.classList.add('hidden');
  }
}

function undoMove() {
  if (moveHistory.length === 0 || gameOver || isAiThinking) return;

  if (gameMode === 'pve' || gameMode === 'blitz') {
    const stepsToUndo = (currentPlayer === humanSide) ? 2 : 1;
    for (let i = 0; i < stepsToUndo; i++) {
      if (moveHistory.length > 0) {
        const last = moveHistory.pop();
        board[last.r][last.c] = EMPTY;
      }
    }
    currentPlayer = humanSide;
  } else {
    const last = moveHistory.pop();
    board[last.r][last.c] = EMPTY;
    currentPlayer = last.player;
  }

  winningLine = null;
  gameOver = false;
  document.getElementById('moveCountText').innerText = moveHistory.length;
  document.getElementById('btnUndo').disabled = (moveHistory.length === 0);

  updateTurnUI();
  render();
  if (gameMode === 'blitz') startBlitzTimer();
  triggerHaptic(15);
}

function resetGame() {
  clearInterval(blitzTimer);
  board = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(EMPTY));
  moveHistory = [];
  currentPlayer = PLAYER_X;
  gameOver = false;
  winningLine = null;
  hoveredCell = null;
  isAiThinking = false;

  document.getElementById('moveCountText').innerText = '0';
  document.getElementById('btnUndo').disabled = true;
  document.getElementById('winModal').classList.add('hidden');
  document.getElementById('aiThinkingBadge').classList.add('hidden');

  if (gameMode === 'tower') {
    const stg = TOWER_STAGES[currentTowerStage - 1];
    humanSide = stg.side;
    aiDifficulty = stg.diff;
  } else if (gameMode === 'puzzle') {
    const puz = PUZZLES[currentPuzzleIndex];
    puz.board.forEach(item => {
      board[item.r][item.c] = item.p;
    });
    humanSide = puz.humanPlayer;
    currentPlayer = puz.humanPlayer;
  }

  updateTurnUI();
  updateModeBanner();
  render();

  if (gameMode === 'blitz') {
    startBlitzTimer();
  }

  if ((gameMode === 'pve' || gameMode === 'tower' || gameMode === 'blitz') && humanSide === PLAYER_O && currentPlayer !== humanSide) {
    triggerAiTurn();
  }
}

function updateTurnUI() {
  const cardX = document.getElementById('playerXCard');
  const cardO = document.getElementById('playerOCard');
  const indX = document.getElementById('turnIndicatorX');
  const indO = document.getElementById('turnIndicatorO');
  const labelX = document.getElementById('labelPlayerX');
  const labelO = document.getElementById('labelPlayerO');
  const subO = document.getElementById('statusSubO');

  if (gameMode === 'tower') {
    const stg = TOWER_STAGES[currentTowerStage - 1];
    labelX.innerText = (stg.side === PLAYER_X) ? 'Bạn (X)' : stg.bossName;
    labelO.innerText = (stg.side === PLAYER_O) ? 'Bạn (O)' : stg.bossName;
  } else if (gameMode === 'puzzle') {
    const puz = PUZZLES[currentPuzzleIndex];
    labelX.innerText = 'Bạn (X)';
    labelO.innerText = 'Thế Cờ VCF';
  } else {
    const diffText = (aiDifficulty === 'easy' ? 'Dễ' : (aiDifficulty === 'hell' ? 'Địa Ngục 💀' : (aiDifficulty === 'hard' ? 'Khó 🔥' : 'Vừa')));
    if (gameMode === 'pvp') {
      labelX.innerText = 'Người chơi X';
      labelO.innerText = 'Người chơi O';
    } else if (humanSide === PLAYER_X) {
      labelX.innerText = 'Bạn (X)';
      labelO.innerText = `Máy (${diffText})`;
    } else {
      labelX.innerText = `Máy (${diffText})`;
      labelO.innerText = 'Bạn (O)';
    }
  }

  if (currentPlayer === PLAYER_X) {
    cardX.classList.remove('opacity-80', 'border-transparent');
    cardX.classList.add('border-cyan-500/60');
    indX.classList.remove('hidden');

    cardO.classList.add('opacity-80', 'border-transparent');
    cardO.classList.remove('border-rose-500/60');
    indO.classList.add('hidden');
    subO.innerText = 'Chờ lượt';
  } else {
    cardO.classList.remove('opacity-80', 'border-transparent');
    cardO.classList.add('border-rose-500/60');
    indO.classList.remove('hidden');
    subO.innerText = (gameMode === 'pvp') ? 'Lượt của O' : 'Lượt của Máy';

    cardX.classList.add('opacity-80', 'border-transparent');
    cardX.classList.remove('border-cyan-500/60');
    indX.classList.add('hidden');
  }
}

function handleGameOver(winner) {
  clearInterval(blitzTimer);
  if (winner === PLAYER_X) score.X++;
  else if (winner === PLAYER_O) score.O++;
  else score.draws++;

  document.getElementById('scoreX').innerText = score.X;
  document.getElementById('scoreO').innerText = score.O;

  const titleEl = document.getElementById('winTitle');
  const descEl = document.getElementById('winDescription');
  const iconEl = document.getElementById('winBadgeIcon');
  const btnModalNext = document.getElementById('btnModalNewGame');

  if (winner === 0) {
    titleEl.innerText = 'HÒA CỜ!';
    titleEl.className = 'font-outfit text-2xl font-black text-slate-300 tracking-wide mb-1';
    descEl.innerText = 'Bàn cờ 19x19 đã kín mà không bên nào đạt 5 quân liên tiếp.';
    iconEl.innerText = '🤝';
    btnModalNext.innerText = 'Chơi Ván Tiếp Theo';
  } else {
    const isX = (winner === PLAYER_X);
    const isHumanWin = (winner === humanSide);

    if (gameMode === 'tower') {
      if (isHumanWin) {
        titleEl.innerText = `ĐÃ CHINH PHỤC TẦNG ${currentTowerStage}! 🎉`;
        titleEl.className = 'font-outfit text-xl font-black text-amber-300 tracking-wide mb-1';
        iconEl.innerText = '👑';

        if (currentTowerStage < TOWER_STAGES.length) {
          currentTowerStage++;
          if (currentTowerStage > maxTowerUnlocked) {
            maxTowerUnlocked = currentTowerStage;
            localStorage.setItem('caro_tower_max', maxTowerUnlocked);
          }
          descEl.innerText = `Chúc mừng! Tầng tiếp theo: ${TOWER_STAGES[currentTowerStage - 1].bossName}`;
          btnModalNext.innerText = `Khiêu Chiến Tầng ${currentTowerStage} ➔`;
        } else {
          descEl.innerText = 'BẠN ĐÃ XUẤT SẮC CHINH PHỤC TOÀN BỘ 5 TẦNG THÁP BOSS!';
          btnModalNext.innerText = 'Tái Đấu Tầng 1';
          currentTowerStage = 1;
        }
      } else {
        titleEl.innerText = 'BỊ BẠI TRẬN!';
        titleEl.className = 'font-outfit text-xl font-black text-rose-400 tracking-wide mb-1';
        descEl.innerText = `${TOWER_STAGES[currentTowerStage - 1].bossName} đã đánh bại bạn tại Tầng ${currentTowerStage}.`;
        iconEl.innerText = '💀';
        btnModalNext.innerText = 'Thử Lại Tầng Này';
      }
    } else if (gameMode === 'puzzle') {
      if (isHumanWin) {
        titleEl.innerText = 'GIẢI ĐỐ THÀNH CÔNG! 🧩';
        titleEl.className = 'font-outfit text-xl font-black text-cyan-400 tracking-wide mb-1';
        iconEl.innerText = '🌟';

        if (currentPuzzleIndex < PUZZLES.length - 1) {
          currentPuzzleIndex++;
          if (currentPuzzleIndex > maxPuzzleUnlocked) {
            maxPuzzleUnlocked = currentPuzzleIndex;
            localStorage.setItem('caro_puzzle_max', maxPuzzleUnlocked);
          }
          descEl.innerText = `Bài tiếp theo: ${PUZZLES[currentPuzzleIndex].title}`;
          btnModalNext.innerText = 'Qua Thế Cờ Tiếp Theo ➔';
        } else {
          descEl.innerText = 'XUẤT SẮC! Bạn đã giải thành công tất cả thế cờ VCF!';
          btnModalNext.innerText = 'Chơi Lại Bài 1';
          currentPuzzleIndex = 0;
        }
      } else {
        titleEl.innerText = 'GIẢI ĐỐ THẤT BẠI!';
        titleEl.className = 'font-outfit text-xl font-black text-rose-400 tracking-wide mb-1';
        descEl.innerText = 'Bạn chưa tìm đúng đường cờ chiến thắng.';
        iconEl.innerText = '❌';
        btnModalNext.innerText = 'Thử Lại Bài Này';
      }
    } else {
      const name = isX
        ? (gameMode === 'pvp' ? 'NGƯỜI CHƠI X' : (humanSide === PLAYER_X ? 'BẠN (X)' : 'MÁY (X)'))
        : (gameMode === 'pvp' ? 'NGƯỜI CHƠI O' : (humanSide === PLAYER_O ? 'BẠN (O)' : 'MÁY (O)'));

      titleEl.innerText = `${name} CHIẾN THẮNG!`;
      titleEl.className = `font-outfit text-xl font-black ${isX ? 'text-cyan-400' : 'text-rose-400'} tracking-wide mb-1`;
      descEl.innerText = `Chúc mừng đã tạo thành công chuỗi 5 quân cờ liên tục!`;
      iconEl.innerText = isX ? '👑' : '🎖️';
      btnModalNext.innerText = 'Chơi Ván Tiếp Theo';
    }

    playWinSound();
    triggerHaptic([40, 60, 40]);
    launchConfetti();
  }

  setTimeout(() => {
    document.getElementById('winModal').classList.remove('hidden');
  }, 700);
}
