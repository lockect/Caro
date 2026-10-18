/* =======================================================================
   GO (CỜ VÂY) ENGINE & DEDICATED AI MODULE
   ======================================================================= */

let goCaptured = { black: 0, white: 0 };

// Lấy tất cả các ô kết nối cùng màu (Group) và tập hợp số Khí (Liberties)
function getGoGroupAndLiberties(r, c, targetBoard) {
  const player = targetBoard[r][c];
  if (player === EMPTY) return { group: [], liberties: new Set() };

  const group = [];
  const liberties = new Set();
  const visited = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(false));
  const queue = [{ r, c }];
  visited[r][c] = true;

  const dirs = [[0, 1], [1, 0], [0, -1], [-1, 0]];

  while (queue.length > 0) {
    const curr = queue.shift();
    group.push(curr);

    for (const [dr, dc] of dirs) {
      const nr = curr.r + dr;
      const nc = curr.c + dc;
      if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE) {
        if (targetBoard[nr][nc] === EMPTY) {
          liberties.add(`${nr},${nc}`);
        } else if (targetBoard[nr][nc] === player && !visited[nr][nc]) {
          visited[nr][nc] = true;
          queue.push({ r: nr, c: nc });
        }
      }
    }
  }

  return { group, liberties };
}

// Kiểm tra và thực hiện Ăn Quân Cờ Vây (Capture Execution)
function processGoCaptures(r, c, player, targetBoard) {
  const oppPlayer = (player === PLAYER_X) ? PLAYER_O : PLAYER_X;
  const dirs = [[0, 1], [1, 0], [0, -1], [-1, 0]];
  let capturedCount = 0;

  for (const [dr, dc] of dirs) {
    const nr = r + dr;
    const nc = c + dc;
    if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE) {
      if (targetBoard[nr][nc] === oppPlayer) {
        const { group, liberties } = getGoGroupAndLiberties(nr, nc, targetBoard);
        if (liberties.size === 0) {
          // Ăn toàn bộ nhóm quân hết khí!
          for (let p of group) {
            targetBoard[p.r][p.c] = EMPTY;
            capturedCount++;
          }
        }
      }
    }
  }

  if (capturedCount > 0) {
    if (player === PLAYER_X) goCaptured.black += capturedCount;
    else goCaptured.white += capturedCount;
  }

  return capturedCount;
}

// Kiểm tra Nước đi Hợp lệ Cờ Vây (Liberty & Suicide Rule)
function isValidGoMove(r, c, player, targetBoard) {
  if (targetBoard[r][c] !== EMPTY) return false;

  // Bản sao thử nghiệm
  const tempBoard = targetBoard.map(row => [...row]);
  tempBoard[r][c] = player;

  const oppPlayer = (player === PLAYER_X) ? PLAYER_O : PLAYER_X;
  const dirs = [[0, 1], [1, 0], [0, -1], [-1, 0]];
  let capturedAny = false;

  // Thử ăn quân đối phương
  for (const [dr, dc] of dirs) {
    const nr = r + dr;
    const nc = c + dc;
    if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE) {
      if (tempBoard[nr][nc] === oppPlayer) {
        const { liberties } = getGoGroupAndLiberties(nr, nc, tempBoard);
        if (liberties.size === 0) {
          capturedAny = true;
        }
      }
    }
  }

  // Nếu không ăn được quân nào, kiểm tra xem nhóm cờ vừa hạ có bị tự sát (0 khí) không
  if (!capturedAny) {
    const { liberties } = getGoGroupAndLiberties(r, c, tempBoard);
    if (liberties.size === 0) {
      return false; // Nước tự sát -> Không hợp lệ
    }
  }

  return true;
}

/* =======================================================================
   DEDICATED GO AI (AI CỜ VÂY CHUYÊN SÂU)
   ======================================================================= */
function getBestGoAiMove(aiPlayer) {
  const oppPlayer = (aiPlayer === PLAYER_X) ? PLAYER_O : PLAYER_X;
  const candidates = [];
  const visited = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(false));

  // Nước đi đầu tiên
  if (moveHistory.length === 0) {
    return { r: 9, c: 9 };
  }

  // Quét các ô xung quanh quân cờ đã đánh
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c] !== EMPTY) {
        for (let dr = -2; dr <= 2; dr++) {
          for (let dc = -2; dc <= 2; dc++) {
            const nr = r + dr;
            const nc = c + dc;
            if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE) {
              if (board[nr][nc] === EMPTY && !visited[nr][nc]) {
                visited[nr][nc] = true;
                if (isValidGoMove(nr, nc, aiPlayer, board)) {
                  candidates.push({ r: nr, c: nc });
                }
              }
            }
          }
        }
      }
    }
  }

  if (candidates.length === 0) return { r: 9, c: 9 };

  // Đánh giá từng ô ứng viên cho Cờ Vây (Liberties, Atari, Captures, Territory)
  const scoredMoves = candidates.map(cell => {
    let score = 0;
    const tempBoard = board.map(row => [...row]);
    tempBoard[cell.r][cell.c] = aiPlayer;

    // 1. Kiểm tra ăn quân đối phương (Capture Bonus)
    const dirs = [[0, 1], [1, 0], [0, -1], [-1, 0]];

    for (const [dr, dc] of dirs) {
      const nr = cell.r + dr;
      const nc = cell.c + dc;
      if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE) {
        if (board[nr][nc] === oppPlayer) {
          const { liberties, group } = getGoGroupAndLiberties(nr, nc, board);
          if (liberties.size === 1 && liberties.has(`${cell.r},${cell.c}`)) {
            // Nước đi này ĂN QUÂN đối phương!
            score += group.length * 10000;
          } else if (liberties.size === 2 && liberties.has(`${cell.r},${cell.c}`)) {
            // Bắt cờ Atari đối phương (Chỉ còn 1 khí)!
            score += 3500;
          }
        }
      }
    }

    // 2. Giải cứu nhóm cờ quân mình đang bị Bắt (Atari Defense)
    for (const [dr, dc] of dirs) {
      const nr = cell.r + dr;
      const nc = cell.c + dc;
      if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE) {
        if (board[nr][nc] === aiPlayer) {
          const { liberties, group } = getGoGroupAndLiberties(nr, nc, board);
          if (liberties.size === 1 && liberties.has(`${cell.r},${cell.c}`)) {
            // Nước đi này CỨU CỜ quân mình!
            score += group.length * 8000;
          }
        }
      }
    }

    // 3. Số Khí (Liberties) của nhóm cờ vừa tạo
    const { liberties: myLiberties } = getGoGroupAndLiberties(cell.r, cell.c, tempBoard);
    score += myLiberties.size * 150;

    // 4. Mở rộng lãnh thổ (Khoảng cách trung tâm & các Điểm Sao / Góc)
    const centerDist = Math.hypot(cell.r - 9, cell.c - 9);
    score += (10 - centerDist) * 35;

    return { ...cell, score };
  });

  scoredMoves.sort((a, b) => b.score - a.score);
  return scoredMoves[0];
}

function triggerGoAiTurn() {
  isAiThinking = true;
  const badge = document.getElementById('aiThinkingBadge');
  if (badge) {
    badge.classList.remove('hidden');
    badge.classList.add('flex');
  }

  setTimeout(() => {
    try {
      if (gameOver) return;

      const bestMove = getBestGoAiMove(currentPlayer);

      isAiThinking = false;
      if (badge) {
        badge.classList.add('hidden');
        badge.classList.remove('flex');
      }

      if (bestMove) {
        makeMove(bestMove.r, bestMove.c);
      }
    } catch (err) {
      console.error('Go AI execution error:', err);
      isAiThinking = false;
      if (badge) {
        badge.classList.add('hidden');
        badge.classList.remove('flex');
      }
    }
  }, 250);
}
