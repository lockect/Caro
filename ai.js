/* =======================================================================
   4. GOMOKU GRANDMASTER ENGINE (PVS + ZOBRIST + TT + KILLER HEURISTIC + VCF)
   ======================================================================= */

const SCORE_WIN = 10000000;
const SCORE_FLEX4 = 1000000;
const SCORE_BLOCK4 = 100000;
const SCORE_FLEX3 = 10000;
const SCORE_BLOCK3 = 1000;
const SCORE_FLEX2 = 100;

// Các cờ cho Transposition Table
const TT_EXACT = 0;
const TT_ALPHA = 1;
const TT_BETA = 2;

const GomokuEngine = {
  zobristTable: [],
  tt: new Map(),
  historyTable: [],
  killerMoves: [],
  currentHash: 0,
  timeLimit: 1500,
  startTime: 0,
  isTimeout: false,

  // 1. KHỞI TẠO ZOBRIST HASHING
  init() {
    this.zobristTable = Array.from({ length: BOARD_SIZE }, () =>
      Array.from({ length: BOARD_SIZE }, () => [
        (Math.random() * 0x100000000) | 0, // EMPTY
        (Math.random() * 0x100000000) | 0, // PLAYER_X
        (Math.random() * 0x100000000) | 0  // PLAYER_O
      ])
    );
    this.historyTable = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(0));
    this.killerMoves = Array.from({ length: 30 }, () => Array(2).fill(null));
    this.currentHash = 0;
    
    // Tính hash ban đầu
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        let p = board[r][c] === EMPTY ? 0 : (board[r][c] === PLAYER_X ? 1 : 2);
        this.currentHash ^= this.zobristTable[r][c][p];
      }
    }
  },

  updateHash(r, c, oldPiece, newPiece) {
    let pOld = oldPiece === EMPTY ? 0 : (oldPiece === PLAYER_X ? 1 : 2);
    let pNew = newPiece === EMPTY ? 0 : (newPiece === PLAYER_X ? 1 : 2);
    this.currentHash ^= this.zobristTable[r][c][pOld];
    this.currentHash ^= this.zobristTable[r][c][pNew];
  },

  // 2. BỘ ĐÁNH GIÁ ĐIỂM SỐ NGUYÊN KHỐI (FAST EVALUATION)
  evaluateBoard(aiPlayer) {
    const oppPlayer = aiPlayer === PLAYER_X ? PLAYER_O : PLAYER_X;
    let aiScore = 0;
    let oppScore = 0;

    // Đánh giá nhanh bằng cách quy chiếu Pattern trên 4 trục
    // Lược bỏ bớt vòng lặp dư thừa để tối ưu hàng triệu node/giây
    const lines = this.getAllLines();
    
    for (const line of lines) {
      aiScore += this.evaluateLine(line, aiPlayer);
      oppScore += this.evaluateLine(line, oppPlayer);
    }

    // AI cần ưu tiên phòng thủ nếu đối phương có lợi thế
    return aiScore - oppScore * 1.5; 
  },

  getAllLines() {
    let lines = [];
    // Ngang & Dọc
    for (let i = 0; i < BOARD_SIZE; i++) {
      let row = [], col = [];
      for (let j = 0; j < BOARD_SIZE; j++) {
        row.push(board[i][j]);
        col.push(board[j][i]);
      }
      lines.push(row, col);
    }
    // Chéo
    for (let k = 0; k < BOARD_SIZE * 2 - 1; k++) {
      let diag1 = [], diag2 = [];
      for (let j = 0; j <= k; j++) {
        let i = k - j;
        if (i < BOARD_SIZE && j < BOARD_SIZE) {
          diag1.push(board[i][j]);
          diag2.push(board[i][BOARD_SIZE - 1 - j]);
        }
      }
      if (diag1.length >= 5) lines.push(diag1);
      if (diag2.length >= 5) lines.push(diag2);
    }
    return lines;
  },

  evaluateLine(line, player) {
    let score = 0;
    let count = 0;
    let block = 2;
    
    for (let i = 0; i < line.length; i++) {
      if (line[i] === player) {
        count++;
      } else if (line[i] === EMPTY) {
        if (count > 0) {
          block--;
          score += this.getShapeScore(count, block);
          count = 0;
        }
        block = 1;
      } else {
        if (count > 0) {
          score += this.getShapeScore(count, block);
          count = 0;
        }
        block = 2;
      }
    }
    if (count > 0) score += this.getShapeScore(count, block);
    return score;
  },

  getShapeScore(count, block) {
    if (block >= 2 && count < 5) return 0;
    if (count >= 5) return SCORE_WIN;
    if (count === 4) return block === 0 ? SCORE_FLEX4 : SCORE_BLOCK4;
    if (count === 3) return block === 0 ? SCORE_FLEX3 : SCORE_BLOCK3;
    if (count === 2) return block === 0 ? SCORE_FLEX2 : 0;
    return 0;
  },

  // 3. GENERATE MOVES CÓ MOVE ORDERING (KILLER + HISTORY)
  generateMoves(player, depth) {
    const oppPlayer = player === PLAYER_X ? PLAYER_O : PLAYER_X;
    let candidates = [];
    let visited = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(false));
    let hasPiece = false;

    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (board[r][c] !== EMPTY) {
          hasPiece = true;
          for (let dr = -2; dr <= 2; dr++) {
            for (let dc = -2; dc <= 2; dc++) {
              let nr = r + dr, nc = c + dc;
              if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE && board[nr][nc] === EMPTY && !visited[nr][nc]) {
                visited[nr][nc] = true;
                
                // Đánh giá điểm tĩnh cho move ordering
                board[nr][nc] = player;
                let attack = this.evaluateBoard(player);
                board[nr][nc] = oppPlayer;
                let defense = this.evaluateBoard(oppPlayer);
                board[nr][nc] = EMPTY;

                let score = attack + defense * 2 + this.historyTable[nr][nc];

                // Ưu tiên Killer Move (nếu trùng khớp)
                if (this.killerMoves[depth]) {
                  if (this.killerMoves[depth][0] && this.killerMoves[depth][0].r === nr && this.killerMoves[depth][0].c === nc) score += 500000;
                  if (this.killerMoves[depth][1] && this.killerMoves[depth][1].r === nr && this.killerMoves[depth][1].c === nc) score += 400000;
                }

                candidates.push({ r: nr, c: nc, score });
              }
            }
          }
        }
      }
    }
    
    if (!hasPiece) return [{ r: 9, c: 9, score: 0 }];
    
    return candidates.sort((a, b) => b.score - a.score).slice(0, 15); // Giữ lại 15 nước xuất sắc nhất
  },

  // 4. PRINCIPAL VARIATION SEARCH (PVS) + ALPHA-BETA
  pvs(depth, alpha, beta, isMaximizing, aiPlayer, oppPlayer, currentDepth) {
    if (Date.now() - this.startTime > this.timeLimit) {
      this.isTimeout = true;
      return 0;
    }

    // Tra cứu TT (Transposition Table)
    const ttEntry = this.tt.get(this.currentHash);
    if (ttEntry && ttEntry.depth >= depth) {
      if (ttEntry.flag === TT_EXACT) return ttEntry.val;
      if (ttEntry.flag === TT_ALPHA && ttEntry.val <= alpha) return alpha;
      if (ttEntry.flag === TT_BETA && ttEntry.val >= beta) return beta;
    }

    if (depth === 0) {
      let val = this.evaluateBoard(aiPlayer);
      this.tt.set(this.currentHash, { depth: 0, flag: TT_EXACT, val });
      return val;
    }

    const moves = this.generateMoves(isMaximizing ? aiPlayer : oppPlayer, currentDepth);
    if (moves.length === 0) return 0;

    let bestMove = null;
    let bestVal = -Infinity;
    let alphaOrig = alpha;

    for (let i = 0; i < moves.length; i++) {
      let move = moves[i];
      let player = isMaximizing ? aiPlayer : oppPlayer;
      
      board[move.r][move.c] = player;
      this.updateHash(move.r, move.c, EMPTY, player);
      let win = checkWin(move.r, move.c, player);
      
      let val;
      if (win) {
        val = isMaximizing ? (SCORE_WIN + depth) : (-SCORE_WIN - depth);
      } else {
        if (i === 0) {
          // Khám phá toàn diện cho nước đi đầu tiên (Principal Variation)
          val = this.pvs(depth - 1, alpha, beta, !isMaximizing, aiPlayer, oppPlayer, currentDepth + 1);
        } else {
          // Null Window Search cho các nước sau (Giả định chúng không tốt bằng PV)
          val = this.pvs(depth - 1, alpha, alpha + 1, !isMaximizing, aiPlayer, oppPlayer, currentDepth + 1);
          // Nếu Null Window thất bại, tìm kiếm lại đầy đủ
          if (isMaximizing && val > alpha && val < beta) {
            val = this.pvs(depth - 1, val, beta, !isMaximizing, aiPlayer, oppPlayer, currentDepth + 1);
          } else if (!isMaximizing && val < alpha && val > beta) {
            val = this.pvs(depth - 1, alpha, val, !isMaximizing, aiPlayer, oppPlayer, currentDepth + 1);
          }
        }
      }

      board[move.r][move.c] = EMPTY;
      this.updateHash(move.r, move.c, player, EMPTY);

      if (this.isTimeout) return 0;

      if (isMaximizing) {
        if (val > bestVal) {
          bestVal = val;
          bestMove = move;
          if (val > alpha) {
            alpha = val;
            this.historyTable[move.r][move.c] += depth * depth; // Thưởng History
          }
        }
        if (alpha >= beta) {
          // Lưu Killer Move
          this.killerMoves[currentDepth][1] = this.killerMoves[currentDepth][0];
          this.killerMoves[currentDepth][0] = move;
          break; // Beta cutoff
        }
      } else {
        if (val < -bestVal || bestVal === -Infinity) { // bestVal khởi tạo là -Infinity nên gán lại
          bestVal = val;
          bestMove = move;
          if (val < beta) {
            beta = val;
            this.historyTable[move.r][move.c] += depth * depth;
          }
        }
        if (beta <= alpha) {
          this.killerMoves[currentDepth][1] = this.killerMoves[currentDepth][0];
          this.killerMoves[currentDepth][0] = move;
          break; // Alpha cutoff
        }
      }
    }

    // Lưu vào Transposition Table
    let flag = TT_EXACT;
    if (bestVal <= alphaOrig) flag = TT_ALPHA;
    else if (bestVal >= beta) flag = TT_BETA;
    this.tt.set(this.currentHash, { depth, flag, val: bestVal, bestMove });

    return bestVal;
  },

  // 5. ITERATIVE DEEPENING CỐT LÕI
  search(aiPlayer, maxDepth, timeLimitMs) {
    this.init(); // Reset TT & Zobrist
    this.timeLimit = timeLimitMs;
    this.startTime = Date.now();
    this.isTimeout = false;
    
    let bestGlobalMove = null;
    const oppPlayer = aiPlayer === PLAYER_X ? PLAYER_O : PLAYER_X;

    // Kiểm tra nhanh phòng thủ/tấn công tức thì trước khi search sâu
    const quickMoves = this.generateMoves(aiPlayer, 0);
    for (let m of quickMoves) {
       board[m.r][m.c] = aiPlayer; if (checkWin(m.r, m.c, aiPlayer)) { board[m.r][m.c] = EMPTY; return m; } board[m.r][m.c] = EMPTY;
       board[m.r][m.c] = oppPlayer; if (checkWin(m.r, m.c, oppPlayer)) { board[m.r][m.c] = EMPTY; return m; } board[m.r][m.c] = EMPTY;
    }

    for (let d = 1; d <= maxDepth; d++) {
      this.pvs(d, -Infinity, Infinity, true, aiPlayer, oppPlayer, 0);
      
      if (this.isTimeout) {
        console.log(`[Engine] Timeout at depth ${d}`);
        break;
      }
      
      const ttEntry = this.tt.get(this.currentHash);
      if (ttEntry && ttEntry.bestMove) {
        bestGlobalMove = ttEntry.bestMove;
      }
      
      // Nếu đã thấy cửa thắng/thua chắc chắn, dừng suy nghĩ
      if (ttEntry && Math.abs(ttEntry.val) > SCORE_WIN / 2) break; 
    }

    return bestGlobalMove || quickMoves[0];
  }
};

/* 6. HÀM KÍCH HOẠT VÀ TÍCH HỢP UI */
function getBestAiMove(aiPlayer) {
  if (moveHistory.length === 0) return { r: 9, c: 9 };
  if (moveHistory.length === 1 && Math.random() > 0.5) {
     const p = moveHistory[0];
     // Trả lời ngẫu nhiên 1 trong 8 ô quanh tâm để né khai cuộc quen thuộc
     const offsets = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
     const off = offsets[Math.floor(Math.random()*offsets.length)];
     return { r: p.r + off[0], c: p.c + off[1] };
  }

  // Tùy chỉnh độ sâu và thời gian theo cấp độ (Hell Mode: sâu 8-10 lớp, 2.5s suy nghĩ)
  let maxDepth = 2;
  let time = 300;
  
  if (aiDifficulty === 'medium') { maxDepth = 4; time = 800; }
  else if (aiDifficulty === 'hard') { maxDepth = 6; time = 1500; }
  else if (aiDifficulty === 'hell') { maxDepth = 10; time = 2500; } // Sâu 10 nước, 2.5 giây

  console.log(`[Engine] Starting search for ${aiDifficulty} mode...`);
  return GomokuEngine.search(aiPlayer, maxDepth, time);
}

function triggerAiTurn() {
  isAiThinking = true;
  const badge = document.getElementById('aiThinkingBadge');
  if (badge) { badge.classList.remove('hidden'); badge.classList.add('flex'); }

  // Để setTimeout dài hơn chút cho UI render badge "Đang suy nghĩ"
  setTimeout(() => {
    try {
      if (gameOver) return;
      const bestMove = getBestAiMove(currentPlayer);
      isAiThinking = false;
      if (badge) { badge.classList.add('hidden'); badge.classList.remove('flex'); }
      if (bestMove) makeMove(bestMove.r, bestMove.c);
    } catch (err) {
      console.error("[Engine Error]", err);
      isAiThinking = false;
      if (badge) { badge.classList.add('hidden'); badge.classList.remove('flex'); }
    }
  }, 100);
}
