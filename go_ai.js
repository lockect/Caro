/* =======================================================================
   GO (CỜ VÂY) ENGINE & MCTS AI MODULE
   ======================================================================= */

let goCaptured = { black: 0, white: 0 };

// 1. CÁC HÀM LUẬT CHƠI CỐT LÕI (Giữ nguyên logic của bạn)
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
          for (let p of group) {
            targetBoard[p.r][p.c] = EMPTY;
            capturedCount++;
          }
        }
      }
    }
  }
  return capturedCount;
}

function isValidGoMove(r, c, player, targetBoard) {
  if (targetBoard[r][c] !== EMPTY) return false;
  const tempBoard = targetBoard.map(row => [...row]);
  tempBoard[r][c] = player;
  const oppPlayer = (player === PLAYER_X) ? PLAYER_O : PLAYER_X;
  const dirs = [[0, 1], [1, 0], [0, -1], [-1, 0]];
  let capturedAny = false;

  for (const [dr, dc] of dirs) {
    const nr = r + dr;
    const nc = c + dc;
    if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE) {
      if (tempBoard[nr][nc] === oppPlayer) {
        const { liberties } = getGoGroupAndLiberties(nr, nc, tempBoard);
        if (liberties.size === 0) capturedAny = true;
      }
    }
  }

  if (!capturedAny) {
    const { liberties } = getGoGroupAndLiberties(r, c, tempBoard);
    if (liberties.size === 0) return false;
  }
  return true;
}

/* =======================================================================
   MCTS (MONTE CARLO TREE SEARCH) - AI ĐỘ KHÓ CỰC CAO
   ======================================================================= */

class MCTSNode {
  constructor(boardState, player, move = null, parent = null) {
    this.boardState = boardState; 
    this.player = player; // Người vừa đánh nước này
    this.move = move;
    this.parent = parent;
    this.children = [];
    this.visits = 0;
    this.score = 0;
    this.untriedMoves = this.generateValidMoves();
  }

  generateValidMoves() {
    const moves = [];
    const nextPlayer = (this.player === PLAYER_X) ? PLAYER_O : PLAYER_X;
    // Tối ưu: Chỉ quét xung quanh các quân cờ đã có (khoảng cách 2 ô) để giảm không gian tìm kiếm
    const searchArea = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(false));
    let hasPieces = false;

    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (this.boardState[r][c] !== EMPTY) {
          hasPieces = true;
          for (let dr = -2; dr <= 2; dr++) {
            for (let dc = -2; dc <= 2; dc++) {
              const nr = r + dr, nc = c + dc;
              if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE) {
                searchArea[nr][nc] = true;
              }
            }
          }
        }
      }
    }

    if (!hasPieces) return [{ r: Math.floor(BOARD_SIZE/2), c: Math.floor(BOARD_SIZE/2) }]; // Đánh giữa bàn nếu bàn trống

    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (searchArea[r][c] && isValidGoMove(r, c, nextPlayer, this.boardState)) {
          moves.push({ r, c });
        }
      }
    }
    // Trộn ngẫu nhiên để Exploration đa dạng
    return moves.sort(() => Math.random() - 0.5);
  }

  // Thuật toán UCB1 (Upper Confidence Bound)
  getBestChild(explorationParam = 1.414) {
    let bestValue = -Infinity;
    let bestNodes = [];
    for (const child of this.children) {
      const ucb1 = (child.score / child.visits) + explorationParam * Math.sqrt(Math.log(this.visits) / child.visits);
      if (ucb1 > bestValue) {
        bestValue = ucb1;
        bestNodes = [child];
      } else if (ucb1 === bestValue) {
        bestNodes.push(child);
      }
    }
    return bestNodes[Math.floor(Math.random() * bestNodes.length)];
  }
}

// Đánh giá tĩnh trạng thái bàn cờ (Tái sử dụng Heuristic của bạn để đánh giá nhanh)
function evaluateBoardState(tempBoard, aiPlayer) {
  let score = 0;
  const oppPlayer = (aiPlayer === PLAYER_X) ? PLAYER_O : PLAYER_X;

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (tempBoard[r][c] === aiPlayer) {
        const { liberties, group } = getGoGroupAndLiberties(r, c, tempBoard);
        score += liberties.size * 10;
        if (liberties.size <= 1) score -= group.length * 500; // Phạt nặng nếu để cờ sắp chết
      } else if (tempBoard[r][c] === oppPlayer) {
        const { liberties, group } = getGoGroupAndLiberties(r, c, tempBoard);
        score -= liberties.size * 10;
        if (liberties.size <= 1) score += group.length * 500; // Thưởng lớn nếu dồn đối phương
      }
    }
  }
  return score;
}

function getBestGoAiMove(aiPlayer) {
  const timeLimit = 3000; // AI có 1.5 giây để suy nghĩ (chỉnh cao hơn nếu muốn AI khôn hơn)
  const startTime = Date.now();
  const oppPlayer = (aiPlayer === PLAYER_X) ? PLAYER_O : PLAYER_X;
  
  // Khởi tạo gốc cây
  const rootBoard = board.map(row => [...row]);
  const root = new MCTSNode(rootBoard, oppPlayer);

  // Vòng lặp MCTS
  let iterations = 0;
  while (Date.now() - startTime < timeLimit) {
    let node = root;
    let tempBoard = node.boardState.map(row => [...row]);
    let currPlayer = oppPlayer;

    // 1. SELECTION (Chọn node)
    while (node.untriedMoves.length === 0 && node.children.length > 0) {
      node = node.getBestChild();
      tempBoard[node.move.r][node.move.c] = node.player;
      processGoCaptures(node.move.r, node.move.c, node.player, tempBoard);
      currPlayer = node.player;
    }

    // 2. EXPANSION (Mở rộng node)
    if (node.untriedMoves.length > 0) {
      const move = node.untriedMoves.pop();
      currPlayer = (currPlayer === PLAYER_X) ? PLAYER_O : PLAYER_X;
      tempBoard[move.r][move.c] = currPlayer;
      processGoCaptures(move.r, move.c, currPlayer, tempBoard);
      
      const childNode = new MCTSNode(tempBoard.map(row => [...row]), currPlayer, move, node);
      node.children.push(childNode);
      node = childNode;
    }

    // 3. SIMULATION (Mô phỏng Playout) - Đi tiếp 5 nước ngẫu nhiên để dò mìn
    let simPlayer = currPlayer;
    for (let step = 0; step < 5; step++) {
      simPlayer = (simPlayer === PLAYER_X) ? PLAYER_O : PLAYER_X;
      const validMoves = [];
      for(let i=0; i<10; i++) { // Lấy mẫu ngẫu nhiên 10 ô để tăng tốc
        const r = Math.floor(Math.random() * BOARD_SIZE);
        const c = Math.floor(Math.random() * BOARD_SIZE);
        if(isValidGoMove(r, c, simPlayer, tempBoard)) validMoves.push({r, c});
      }
      if (validMoves.length > 0) {
        const m = validMoves[0];
        tempBoard[m.r][m.c] = simPlayer;
        processGoCaptures(m.r, m.c, simPlayer, tempBoard);
      } else {
        break;
      }
    }

    // Lấy điểm số từ Heuristic
    const finalScore = evaluateBoardState(tempBoard, aiPlayer);

    // 4. BACKPROPAGATION (Cập nhật ngược)
    while (node !== null) {
      node.visits++;
      // Nếu là node của AI, cộng điểm. Nếu là node đối thủ, trừ điểm
      if (node.player === aiPlayer) {
        node.score += finalScore;
      } else {
        node.score -= finalScore;
      }
      node = node.parent;
    }
    iterations++;
  }

  console.log(`MCTS hoàn tất ${iterations} vòng lặp.`);

  if (root.children.length === 0) return { r: Math.floor(BOARD_SIZE/2), c: Math.floor(BOARD_SIZE/2) };

  // Chọn nước đi được duyệt nhiều nhất (chắc chắn nhất)
  let bestMoveNode = root.children[0];
  for (const child of root.children) {
    if (child.visits > bestMoveNode.visits) {
      bestMoveNode = child;
    }
  }

  return bestMoveNode.move;
}

// Gọi AI
function triggerGoAiTurn() {
  isAiThinking = true;
  const badge = document.getElementById('aiThinkingBadge');
  if (badge) {
    badge.classList.remove('hidden');
    badge.classList.add('flex');
  }

  // Sử dụng setTimeout để UI có thời gian render Badge trước khi main thread bị block bởi MCTS
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
  }, 100);
}
