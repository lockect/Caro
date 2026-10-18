/* =======================================================================
   4. ULTRA-HARD ADVANCED GOMOKU AI ENGINE (MINIMAX + ALPHA-BETA + VCF + VCT + BOOK)
   ======================================================================= */

// Cấu hình điểm số Heuristic chuẩn Gomoku Chuyên Nghiệp
const AI_SCORE_FIVE = 100000000;       // 5 liên tiếp (Thắng tuyệt đối)
const AI_SCORE_LIVE_FOUR = 10000000;   // 4 mở 2 đầu (Thắng không thể cản)
const AI_SCORE_FORK_44 = 8000000;      // Nước đôi 4-4
const AI_SCORE_FORK_43 = 5000000;      // Nước đôi 4-3
const AI_SCORE_FORK_33 = 3000000;      // Nước đôi 3-3 (Gọng kìm)
const AI_SCORE_BLOCKED_FOUR = 500000;  // 4 bị chặn 1 đầu / 4 hổng (Bắt buộc cản)
const AI_SCORE_LIVE_THREE = 250000;    // 3 mở 2 đầu (Sắp tạo 4 mở)
const AI_SCORE_BLOCKED_THREE = 15000;  // 3 bị chặn 1 đầu
const AI_SCORE_LIVE_TWO = 5000;        // 2 mở 2 đầu
const AI_SCORE_BLOCKED_TWO = 500;      // 2 bị chặn

/* 1. SÁCH KHAI CUỘC GOMOKU 19x19 (EXPANDED OPENING BOOK) */
const OPENING_BOOK_19 = {
  "": { r: 9, c: 9 }, // Nước đầu tiên luôn hạ Thiên Nguyên (9, 9)
  "(9,9)": [{ r: 9, c: 10 }, { r: 10, c: 9 }, { r: 9, c: 8 }, { r: 8, c: 9 }], // Khai cuộc Trực chỉ
  "(9,9)-(9,10)": [{ r: 10, c: 10 }, { r: 8, c: 10 }, { r: 10, c: 9 }, { r: 8, c: 9 }], // Thẳng sao
  "(9,9)-(10,10)": [{ r: 9, c: 10 }, { r: 10, c: 9 }, { r: 8, c: 9 }, { r: 9, c: 8 }]  // Gián tiếp
};

/* 2. BỘ SOI MẪU CỜ TOÀN DIỆN (COMPREHENSIVE PATTERN MATCHER) */
function evaluateLinePattern(lineStr) {
  let score = 0;
  let live4Count = 0;
  let blocked4Count = 0;
  let live3Count = 0;
  let blocked3Count = 0;

  // 1. Chuỗi 5 liên tiếp
  if (lineStr.includes('PPPPP')) {
    return { score: AI_SCORE_FIVE, live4: 0, blocked4: 0, live3: 0 };
  }

  // 2. 4 mở 2 đầu (_PPPP_)
  if (lineStr.includes('_PPPP_')) {
    live4Count++;
    score += AI_SCORE_LIVE_FOUR;
  }

  // 3. 4 bị chặn 1 đầu hoặc 4 bị hổng lỗ (Broken Four)
  const blocked4Patterns = [
    'OPPPP_', '_PPPPO', '_P_PPP_', '_PPP_P_', '_PP_PP_', '_P_PP_P_', '_PP_P_P_'
  ];
  for (const pat of blocked4Patterns) {
    if (lineStr.includes(pat)) {
      blocked4Count++;
      score += AI_SCORE_BLOCKED_FOUR;
      break;
    }
  }

  // 4. 3 mở 2 đầu (Live 3 & Broken Live 3)
  const live3Patterns = [
    '_PPP_', '_P_PP_', '_PP_P_', '__PPP_', '_PPP__'
  ];
  for (const pat of live3Patterns) {
    if (lineStr.includes(pat)) {
      live3Count++;
      score += AI_SCORE_LIVE_THREE;
      break;
    }
  }

  // 5. 3 bị chặn 1 đầu
  const blocked3Patterns = [
    'OPPP__', '__PPPO', 'OP_PP_', '_PP_PO', 'OPP_P_', '_P_PPO', 'OP_P_P_', '_P_P_PO'
  ];
  for (const pat of blocked3Patterns) {
    if (lineStr.includes(pat)) {
      blocked3Count++;
      score += AI_SCORE_BLOCKED_THREE;
      break;
    }
  }

  // 6. 2 mở 2 đầu
  if (lineStr.includes('__PP__') || lineStr.includes('_P_P_') || lineStr.includes('_P__P_')) {
    score += AI_SCORE_LIVE_TWO;
  }

  return { score, live4: live4Count, blocked4: blocked4Count, live3: live3Count };
}

/* 3. ĐÁNH GIÁ CHI TIẾT TẠI MỘT Ô CỜ (CẢ TẤN CÔNG VÀ ĐÒN THẾ NƯỚC ĐÔI FORK) */
function evaluateCellDetailed(r, c, targetPlayer) {
  board[r][c] = targetPlayer;

  let totalScore = 0;
  let totalLive4 = 0;
  let totalBlocked4 = 0;
  let totalLive3 = 0;

  for (const [dr, dc] of DIRECTIONS) {
    let lineChars = [];
    for (let i = -4; i <= 4; i++) {
      const nr = r + dr * i;
      const nc = c + dc * i;
      if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE) {
        lineChars.push('O'); // Mép bàn cờ tính như ô chặn
      } else if (board[nr][nc] === targetPlayer) {
        lineChars.push('P');
      } else if (board[nr][nc] === EMPTY) {
        lineChars.push('_');
      } else {
        lineChars.push('O');
      }
    }

    const lineStr = lineChars.join('');
    const res = evaluateLinePattern(lineStr);

    totalScore += res.score;
    totalLive4 += res.live4;
    totalBlocked4 += res.blocked4;
    totalLive3 += res.live3;
  }

  board[r][c] = EMPTY;

  // THƯỞNG ĐIỂM NƯỚC ĐÔI (FORK DETECTOR):
  // 1. Nước đôi 4-4 hoặc 4 mở -> Thắng tuyệt đối
  if (totalLive4 >= 1 || totalBlocked4 >= 2) {
    totalScore += AI_SCORE_FORK_44;
  }
  // 2. Nước đôi 4-3 (Một đường 4 + Một đường 3 mở) -> Thắng tuyệt đối
  else if (totalBlocked4 >= 1 && totalLive3 >= 1) {
    totalScore += AI_SCORE_FORK_43;
  }
  // 3. Nước đôi 3-3 (Hai đường 3 mở cùng lúc) -> Thắng tuyệt đối
  else if (totalLive3 >= 2) {
    totalScore += AI_SCORE_FORK_33;
  }

  return totalScore;
}

/* 4. TẠO & SẮP XẾP NƯỚC ĐI ỨNG VIÊN CHẤT LƯỢNG CAO (MOVE ORDERING) */
function getOrderedCandidates(aiPlayer, maxCount = 16) {
  const oppPlayer = (aiPlayer === PLAYER_X) ? PLAYER_O : PLAYER_X;
  const candidates = [];
  const visited = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(false));

  // Quét các ô trống trong bán kính 2 ô quanh các quân cờ đã hạ
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
                candidates.push({ r: nr, c: nc });
              }
            }
          }
        }
      }
    }
  }

  if (candidates.length === 0) return [{ r: 9, c: 9 }];

  // Đánh giá điểm Heuristic Tấn công & Phòng thủ để Move Ordering
  const scored = candidates.map(cell => {
    const attackScore = evaluateCellDetailed(cell.r, cell.c, aiPlayer);
    const defenseScore = evaluateCellDetailed(cell.r, cell.c, oppPlayer);
    const centerDist = Math.hypot(cell.r - 9, cell.c - 9);
    const centerBonus = (10 - centerDist) * 15;

    // Coi trọng phòng thủ cực cao: nhân hệ số 1.35x cho điểm phòng thủ
    let total = attackScore * 1.0 + defenseScore * 1.35 + centerBonus;

    // Nếu đối phương có nước nguy hiểm (4 cờ / 3 mở) -> Bắt buộc nâng điểm ưu tiên cản ngay
    if (defenseScore >= AI_SCORE_BLOCKED_FOUR) total += defenseScore * 2.5;

    return { ...cell, score: total, attackScore, defenseScore };
  });

  scored.sort((a, b) => b.score - a.score);
  return maxCount ? scored.slice(0, maxCount) : scored;
}

/* 5. THREAT SPACE SEARCH: VCF (VICTORY BY CONTINUOUS FOUR) */
function findVCF(player, depthLeft, maxDepth = 14) {
  if (depthLeft <= 0) return null;

  const opp = (player === PLAYER_X) ? PLAYER_O : PLAYER_X;
  const candidates = getOrderedCandidates(player, 18);

  for (let cand of candidates) {
    // Chỉ xét các nước tạo 4 cờ (Four / Blocked Four)
    if (cand.attackScore >= AI_SCORE_BLOCKED_FOUR) {
      board[cand.r][cand.c] = player;

      // Nếu tạo được 5 cờ liên tiếp -> Thắng ngay
      if (checkWin(cand.r, cand.c, player)) {
        board[cand.r][cand.c] = EMPTY;
        return [cand];
      }

      // Đối phương buộc phải chặn ô cản 4
      const oppDefendMoves = getOrderedCandidates(opp, 8).filter(m => m.defenseScore >= AI_SCORE_BLOCKED_FOUR);

      if (oppDefendMoves.length === 0) {
        board[cand.r][cand.c] = EMPTY;
        return [cand];
      }

      let allPathsWin = true;
      let winSubPath = null;

      for (let blockMove of oppDefendMoves) {
        board[blockMove.r][blockMove.c] = opp;
        const subVCF = findVCF(player, depthLeft - 1, maxDepth);
        board[blockMove.r][blockMove.c] = EMPTY;

        if (subVCF) {
          winSubPath = subVCF;
        } else {
          allPathsWin = false;
          break;
        }
      }

      board[cand.r][cand.c] = EMPTY;

      if (allPathsWin && winSubPath) {
        return [cand, ...winSubPath];
      }
    }
  }

  return null;
}

/* 6. THREAT SPACE SEARCH: VCT (VICTORY BY CONTINUOUS THREE) */
function findVCT(player, depthLeft, maxDepth = 8) {
  if (depthLeft <= 0) return null;

  const opp = (player === PLAYER_X) ? PLAYER_O : PLAYER_X;
  const candidates = getOrderedCandidates(player, 12);

  for (let cand of candidates) {
    // Thử các nước tạo 3 mở hoặc 4 cờ
    if (cand.attackScore >= AI_SCORE_LIVE_THREE || cand.attackScore >= AI_SCORE_BLOCKED_FOUR) {
      board[cand.r][cand.c] = player;

      if (checkWin(cand.r, cand.c, player)) {
        board[cand.r][cand.c] = EMPTY;
        return [cand];
      }

      // Kiểm tra xem nước này có tạo ra VCF ngay không
      const vcfDirect = findVCF(player, 8, 8);
      if (vcfDirect) {
        board[cand.r][cand.c] = EMPTY;
        return [cand, ...vcfDirect];
      }

      // Thử nước phòng thủ của đối phương
      const oppDefendMoves = getOrderedCandidates(opp, 6).filter(m => m.defenseScore >= AI_SCORE_LIVE_THREE);
      if (oppDefendMoves.length > 0) {
        let allWin = true;
        let winPath = null;

        for (let block of oppDefendMoves.slice(0, 2)) {
          board[block.r][block.c] = opp;
          const subVCT = findVCT(player, depthLeft - 1, maxDepth);
          board[block.r][block.c] = EMPTY;

          if (subVCT) {
            winPath = subVCT;
          } else {
            allWin = false;
            break;
          }
        }

        if (allWin && winPath) {
          board[cand.r][cand.c] = EMPTY;
          return [cand, ...winPath];
        }
      }

      board[cand.r][cand.c] = EMPTY;
    }
  }

  return null;
}

/* 7. MINIMAX ALPHA-BETA WITH MOVE ORDERING & QUIESCENCE EXTENSION */
function minimaxAlphaBeta(depth, alpha, beta, isMaximizing, aiPlayer, oppPlayer, startTime, timeLimitMs) {
  if (Date.now() - startTime > timeLimitMs) {
    return 0; // Giới hạn thời gian an toàn cho UI thread
  }

  if (depth === 0) {
    // Quiescence Search: Nếu ô cờ đang có mối đe dọa lớn (Blocked 4 / Live 3) -> Mở rộng thêm 1 nấc
    const candidates = getOrderedCandidates(isMaximizing ? aiPlayer : oppPlayer, 4);
    if (candidates.length > 0 && candidates[0].score >= AI_SCORE_BLOCKED_FOUR) {
      depth += 1;
    } else {
      return 0;
    }
  }

  const candidates = getOrderedCandidates(isMaximizing ? aiPlayer : oppPlayer, depth > 3 ? 8 : 6);

  if (isMaximizing) {
    let maxEval = -Infinity;
    for (let cand of candidates) {
      if (cand.attackScore >= AI_SCORE_FIVE) return AI_SCORE_FIVE;

      board[cand.r][cand.c] = aiPlayer;
      const win = checkWin(cand.r, cand.c, aiPlayer);
      let evalVal = win ? (AI_SCORE_FIVE + depth) : minimaxAlphaBeta(depth - 1, alpha, beta, false, aiPlayer, oppPlayer, startTime, timeLimitMs);
      board[cand.r][cand.c] = EMPTY;

      maxEval = Math.max(maxEval, evalVal);
      alpha = Math.max(alpha, evalVal);
      if (beta <= alpha) break; // Alpha-Beta Pruning Cutoff
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for (let cand of candidates) {
      if (cand.attackScore >= AI_SCORE_FIVE) return -AI_SCORE_FIVE;

      board[cand.r][cand.c] = oppPlayer;
      const win = checkWin(cand.r, cand.c, oppPlayer);
      let evalVal = win ? (-AI_SCORE_FIVE - depth) : minimaxAlphaBeta(depth - 1, alpha, beta, true, aiPlayer, oppPlayer, startTime, timeLimitMs);
      board[cand.r][cand.c] = EMPTY;

      minEval = Math.min(minEval, evalVal);
      beta = Math.min(beta, evalVal);
      if (beta <= alpha) break; // Alpha-Beta Pruning Cutoff
    }
    return minEval;
  }
}

/* 8. BỘ CHỌN NƯỚC ĐI TỐI THƯỢNG CHO 4 CẤP ĐỘ KHÓ */
function getBestAiMove(aiPlayer) {
  const oppPlayer = (aiPlayer === PLAYER_X) ? PLAYER_O : PLAYER_X;

  // 1. OPENING BOOK (SÁCH KHAI CUỘC 19x19)
  if (moveHistory.length === 0) {
    return { r: 9, c: 9 };
  }
  if (moveHistory.length === 1 && gameMode === 'pve') {
    const key = `(${moveHistory[0].r},${moveHistory[0].c})`;
    if (OPENING_BOOK_19[key]) {
      const picks = OPENING_BOOK_19[key];
      return picks[Math.floor(Math.random() * picks.length)];
    }
  }

  // 2. CẢNH BÁO KHẨN CẤP: BẮT BUỘC THẮNG NGAY HOẶC BẮT BUỘC CHẶN 4 MỞ / NƯỚC ĐÔI
  const immediateCandidates = getOrderedCandidates(aiPlayer, 15);

  // A. Nếu AI có nước thắng ngay (5 cờ hoặc 4 mở) -> Đánh ngay lập tức!
  for (let cand of immediateCandidates) {
    if (cand.attackScore >= AI_SCORE_FIVE || cand.attackScore >= AI_SCORE_LIVE_FOUR || cand.attackScore >= AI_SCORE_FORK_44) {
      return cand;
    }
  }

  // B. Nếu Đối phương có nước thắng ngay (5 cờ, 4 mở, nước đôi 4-4/4-3) -> BẮT BUỘC CHẶN NGAY!
  for (let cand of immediateCandidates) {
    if (cand.defenseScore >= AI_SCORE_FIVE || cand.defenseScore >= AI_SCORE_LIVE_FOUR || cand.defenseScore >= AI_SCORE_FORK_44 || cand.defenseScore >= AI_SCORE_FORK_43) {
      return cand;
    }
  }

  // 3. PHÂN CHIA NĂNG LỰC THEO 4 CẤP ĐỘ KHÓ:

  // A. CHẾ ĐỘ DỄ (NOVICE - GREEDY DEPTH 2)
  if (aiDifficulty === 'easy') {
    const candidates = getOrderedCandidates(aiPlayer, 12);
    if (candidates.length > 2 && Math.random() < 0.20) {
      return candidates[Math.floor(Math.random() * Math.min(3, candidates.length))];
    }
    return candidates[0];
  }

  // B. CHẾ ĐỘ VỪA (INTERMEDIATE - DEPTH 4 MINIMAX + FORK DEFENSE)
  if (aiDifficulty === 'medium') {
    const candidates = getOrderedCandidates(aiPlayer, 12);

    // Chặn nước đôi 3-3 nếu đối phương có
    if (candidates[0].defenseScore >= AI_SCORE_FORK_33 || candidates[0].defenseScore >= AI_SCORE_BLOCKED_FOUR) {
      return candidates[0];
    }

    let bestMove = candidates[0];
    let bestVal = -Infinity;
    const startTime = Date.now();

    for (let cand of candidates.slice(0, 7)) {
      board[cand.r][cand.c] = aiPlayer;
      let val = minimaxAlphaBeta(3, -Infinity, Infinity, false, aiPlayer, oppPlayer, startTime, 350);
      board[cand.r][cand.c] = EMPTY;

      if (val > bestVal) {
        bestVal = val;
        bestMove = cand;
      }
    }
    return bestMove;
  }

  // C. CHẾ ĐỘ KHÓ (ADVANCED - DEPTH 6 MINIMAX ALPHA-BETA + VCF DEPTH 8)
  if (aiDifficulty === 'hard') {
    // Tìm VCF nhanh 8 nước cho AI
    const quickVCF = findVCF(aiPlayer, 8, 8);
    if (quickVCF && quickVCF.length > 0) return quickVCF[0];

    // Chặn VCF nhanh 8 nước của đối phương
    const oppVCF = findVCF(oppPlayer, 8, 8);
    if (oppVCF && oppVCF.length > 0) return oppVCF[0];

    const candidates = getOrderedCandidates(aiPlayer, 14);
    let bestMove = candidates[0];
    let bestVal = -Infinity;
    const startTime = Date.now();

    for (let cand of candidates.slice(0, 9)) {
      board[cand.r][cand.c] = aiPlayer;
      let val = minimaxAlphaBeta(5, -Infinity, Infinity, false, aiPlayer, oppPlayer, startTime, 650);
      board[cand.r][cand.c] = EMPTY;

      if (val > bestVal) {
        bestVal = val;
        bestMove = cand;
      }
    }
    return bestMove;
  }

  // D. CHẾ ĐỘ ĐỊA NGỤC TỐI THƯỢNG (EXPERT / HELL 💀 - DEPTH 8 MINIMAX + VCF 14 + VCT 8 + MOVE ORDERING)
  if (aiDifficulty === 'hell') {
    // 1. Sâu VCF Solver: Tìm chuỗi dứt điểm VCF 14 nước cho AI
    const vcfWin = findVCF(aiPlayer, 14, 14);
    if (vcfWin && vcfWin.length > 0) {
      console.log('💀 HELL AI: Kích hoạt VCF dứt điểm tuyệt đối!', vcfWin);
      return vcfWin[0];
    }

    // 2. Chặn VCF Solver: Phá chuỗi VCF 14 nước của đối phương
    const vcfOppBlock = findVCF(oppPlayer, 14, 14);
    if (vcfOppBlock && vcfOppBlock.length > 0) {
      console.log('💀 HELL AI: Phát hiện & Chặn đứng chuỗi VCF đối phương!', vcfOppBlock);
      return vcfOppBlock[0];
    }

    // 3. Sâu VCT Solver: Tìm chuỗi VCT (Victory by Continuous Three) 8 nước
    const vctWin = findVCT(aiPlayer, 8, 8);
    if (vctWin && vctWin.length > 0) {
      console.log('💀 HELL AI: Kích hoạt VCT dứt điểm gọng kìm 3-3!', vctWin);
      return vctWin[0];
    }

    // 4. Tìm kiếm Minimax Alpha-Beta Depth 7-8 với Move Ordering tinh nhuệ
    const candidates = getOrderedCandidates(aiPlayer, 16);
    let bestMove = candidates[0];
    let bestVal = -Infinity;
    const startTime = Date.now();

    for (let cand of candidates.slice(0, 10)) {
      board[cand.r][cand.c] = aiPlayer;
      let val = minimaxAlphaBeta(7, -Infinity, Infinity, false, aiPlayer, oppPlayer, startTime, 900);
      board[cand.r][cand.c] = EMPTY;

      if (val > bestVal) {
        bestVal = val;
        bestMove = cand;
      }
    }
    return bestMove;
  }

  return getOrderedCandidates(aiPlayer, 1)[0];
}

/* 9. KÍCH HOẠT LƯỢT ĐI CỦA MÁY */
function triggerAiTurn() {
  isAiThinking = true;
  const badge = document.getElementById('aiThinkingBadge');
  if (badge) {
    badge.classList.remove('hidden');
    badge.classList.add('flex');
  }

  const delay = (aiDifficulty === 'hard' || aiDifficulty === 'hell') ? 350 : 200;
  setTimeout(() => {
    try {
      if (gameOver) return;

      const bestMove = getBestAiMove(currentPlayer);

      // Mở khóa cờ isAiThinking trước khi thực hiện makeMove!
      isAiThinking = false;
      if (badge) {
        badge.classList.add('hidden');
        badge.classList.remove('flex');
      }

      if (bestMove) {
        makeMove(bestMove.r, bestMove.c);
      }
    } catch (err) {
      console.error('AI execution error:', err);
      isAiThinking = false;
      if (badge) {
        badge.classList.add('hidden');
        badge.classList.remove('flex');
      }
    }
  }, delay);
}
