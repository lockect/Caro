/* =======================================================================
   3. CANVAS SETUP, HI-DPI & GRAPHICS RENDERING
   ======================================================================= */
const canvas = document.getElementById('boardCanvas');
const ctx = canvas.getContext('2d');
let cellSize = 0;
let boardOffset = 0; // Khoảng cách viền để vẽ tọa độ A-O, 1-15
let canvasDisplaySize = 0;
let confettiAnimationFrame = null;

function resizeCanvas() {
  const container = document.getElementById('boardContainer');
  const maxW = Math.min(window.innerWidth - 24, 540);
  const viewportH = window.visualViewport ? window.visualViewport.height : window.innerHeight;
  const maxH = viewportH * 0.46;
  canvasDisplaySize = Math.floor(Math.min(maxW, maxH));

  if (canvasDisplaySize < 240) canvasDisplaySize = 240;

  const dpr = Math.min(window.devicePixelRatio || 1, 2.5); // Tối ưu sắc nét Retina
  canvas.width = canvasDisplaySize * dpr;
  canvas.height = canvasDisplaySize * dpr;
  canvas.style.width = `${canvasDisplaySize}px`;
  canvas.style.height = `${canvasDisplaySize}px`;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  cellSize = canvasDisplaySize / (BOARD_SIZE + 0.6);
  boardOffset = cellSize * 0.8;

  render();
}

function drawBoardBackground() {
  // 1. Mặt bàn gỗ tự nhiên Kaya
  const grad = ctx.createLinearGradient(0, 0, canvasDisplaySize, canvasDisplaySize);
  grad.addColorStop(0, '#e8be88');
  grad.addColorStop(0.5, '#deb070');
  grad.addColorStop(1, '#c99853');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvasDisplaySize, canvasDisplaySize);

  // Vân gỗ sọc tinh tế
  ctx.save();
  ctx.strokeStyle = 'rgba(120, 53, 15, 0.045)';
  ctx.lineWidth = 1.5;
  for (let y = 3; y < canvasDisplaySize; y += 7) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(canvasDisplaySize * 0.3, y + 2, canvasDisplaySize * 0.7, y - 2, canvasDisplaySize, y);
    ctx.stroke();
  }
  ctx.restore();

  // 2. Kẻ lưới ô cờ 15x15
  ctx.save();
  ctx.lineWidth = 1;
  ctx.strokeStyle = '#5a300a';

  for (let i = 0; i < BOARD_SIZE; i++) {
    const pos = boardOffset + i * cellSize;

    // Kẻ ngang
    ctx.beginPath();
    ctx.moveTo(boardOffset, pos);
    ctx.lineTo(boardOffset + (BOARD_SIZE - 1) * cellSize, pos);
    ctx.stroke();

    // Kẻ dọc
    ctx.beginPath();
    ctx.moveTo(pos, boardOffset);
    ctx.lineTo(pos, boardOffset + (BOARD_SIZE - 1) * cellSize);
    ctx.stroke();
  }

  // 3. Tọa độ (Cột: A-S, Hàng: 1-19)
  ctx.font = `600 ${Math.max(8, cellSize * 0.30)}px 'Outfit', sans-serif`;
  ctx.fillStyle = '#78350f';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const colLetters = 'ABCDEFGHIJKLMNOPQRS';
  for (let i = 0; i < BOARD_SIZE; i++) {
    const pos = boardOffset + i * cellSize;
    ctx.fillText(colLetters[i], pos, boardOffset * 0.45);
    ctx.fillText((i + 1).toString(), boardOffset * 0.45, pos);
  }

  // 4. Các điểm sao chuẩn (Hoshi/Star points) trên bàn cờ 19x19
  const starPoints = [
    { r: 3, c: 3 }, { r: 3, c: 9 }, { r: 3, c: 15 },
    { r: 9, c: 3 }, { r: 9, c: 9 }, { r: 9, c: 15 },
    { r: 15, c: 3 }, { r: 15, c: 9 }, { r: 15, c: 15 }
  ];

  starPoints.forEach(pt => {
    const cx = boardOffset + pt.c * cellSize;
    const cy = boardOffset + pt.r * cellSize;
    ctx.beginPath();
    ctx.arc(cx, cy, Math.max(2.5, cellSize * 0.08), 0, Math.PI * 2);
    ctx.fillStyle = '#5a300a';
    ctx.fill();
  });

  ctx.restore();
}

function drawPiece(r, c, player, isHover = false) {
  const cx = boardOffset + c * cellSize;
  const cy = boardOffset + r * cellSize;
  const radius = cellSize * 0.42;

  // Xử lý riêng cho Chế độ Cờ Vây (Go): Quân tròn Đen / Trắng tự nhiên không có ký hiệu X/O
  if (gameMode === 'go') {
    ctx.save();
    if (isHover) ctx.globalAlpha = 0.45;

    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = isHover ? 2 : 7;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 4;

    const grad = ctx.createRadialGradient(
      cx - radius * 0.35, cy - radius * 0.35, radius * 0.1,
      cx, cy, radius
    );

    if (player === PLAYER_X) {
      // Đá Cờ Vây Đen (Black Slate Stone)
      grad.addColorStop(0, '#475569');
      grad.addColorStop(0.6, '#1e293b');
      grad.addColorStop(1, '#020617');
    } else {
      // Đá Cờ Vây Trắng (White Shell Stone)
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.75, '#f1f5f9');
      grad.addColorStop(1, '#cbd5e1');
    }

    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    if (player === PLAYER_O) {
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.4)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    ctx.restore();
    return;
  }

  // Các chế độ Caro / Gomoku thông thường (X & O có ký hiệu nổi)
  ctx.save();
  if (isHover) {
    ctx.globalAlpha = 0.45;
  }

  // Đổ bóng 3D
  ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
  ctx.shadowBlur = isHover ? 2 : 6;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 3;

  const grad = ctx.createRadialGradient(
    cx - radius * 0.3, cy - radius * 0.3, radius * 0.1,
    cx, cy, radius
  );

  if (player === PLAYER_X) {
    grad.addColorStop(0, '#334155');
    grad.addColorStop(0.7, '#0f172a');
    grad.addColorStop(1, '#020617');
  } else {
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.7, '#f8fafc');
    grad.addColorStop(1, '#cbd5e1');
  }

  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.shadowColor = 'transparent';

  const emblemSize = radius * 0.55;
  ctx.lineWidth = Math.max(2.5, radius * 0.22);
  ctx.lineCap = 'round';

  if (player === PLAYER_X) {
    ctx.strokeStyle = '#22d3ee';
    ctx.beginPath();
    ctx.moveTo(cx - emblemSize, cy - emblemSize);
    ctx.lineTo(cx + emblemSize, cy + emblemSize);
    ctx.moveTo(cx + emblemSize, cy - emblemSize);
    ctx.lineTo(cx - emblemSize, cy + emblemSize);
    ctx.stroke();
  } else {
    ctx.strokeStyle = '#f43f5e';
    ctx.beginPath();
    ctx.arc(cx, cy, emblemSize * 0.9, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}

function drawLastMoveMarker() {
  if (moveHistory.length === 0) return;
  const lastMove = moveHistory[moveHistory.length - 1];
  const cx = boardOffset + lastMove.c * cellSize;
  const cy = boardOffset + lastMove.r * cellSize;

  ctx.save();
  ctx.strokeStyle = '#fbbf24';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, cellSize * 0.46, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = '#fbbf24';
  ctx.beginPath();
  ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawWinningEffect() {
  if (!winningLine || winningLine.length < 5) return;

  const p1 = winningLine[0];
  const p2 = winningLine[winningLine.length - 1];
  const x1 = boardOffset + p1.c * cellSize;
  const y1 = boardOffset + p1.r * cellSize;
  const x2 = boardOffset + p2.c * cellSize;
  const y2 = boardOffset + p2.r * cellSize;

  ctx.save();
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.shadowColor = '#fbbf24';
  ctx.shadowBlur = 14;

  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();

  winningLine.forEach(cell => {
    const cx = boardOffset + cell.c * cellSize;
    const cy = boardOffset + cell.r * cellSize;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(cx, cy, cellSize * 0.44, 0, Math.PI * 2);
    ctx.stroke();
  });

  ctx.restore();
}

function render() {
  ctx.clearRect(0, 0, canvasDisplaySize, canvasDisplaySize);
  drawBoardBackground();

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c] !== EMPTY) {
        drawPiece(r, c, board[r][c]);
      }
    }
  }

  if (hoveredCell && !gameOver && !isAiThinking && board[hoveredCell.r][hoveredCell.c] === EMPTY) {
    drawPiece(hoveredCell.r, hoveredCell.c, currentPlayer, true);
  }

  drawLastMoveMarker();
  drawWinningEffect();
}

function launchConfetti() {
  const cCanvas = document.getElementById('confettiCanvas');
  const cCtx = cCanvas.getContext('2d');
  cCanvas.width = window.innerWidth;
  cCanvas.height = window.innerHeight;

  const particles = Array.from({ length: 90 }, () => ({
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
    vx: (Math.random() - 0.5) * 14,
    vy: (Math.random() - 0.7) * 14,
    size: Math.random() * 6 + 4,
    color: ['#22d3ee', '#f43f5e', '#fbbf24', '#38bdf8', '#a855f7'][Math.floor(Math.random() * 5)],
    rot: Math.random() * 360,
    vRot: (Math.random() - 0.5) * 10,
    gravity: 0.22,
    alpha: 1
  }));

  function renderConfetti() {
    cCtx.clearRect(0, 0, cCanvas.width, cCanvas.height);
    let activeCount = 0;

    particles.forEach(p => {
      if (p.alpha <= 0.01) return;
      activeCount++;
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity;
      p.rot += p.vRot;
      p.alpha -= 0.009;

      cCtx.save();
      cCtx.globalAlpha = Math.max(0, p.alpha);
      cCtx.translate(p.x, p.y);
      cCtx.rotate((p.rot * Math.PI) / 180);
      cCtx.fillStyle = p.color;
      cCtx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.7);
      cCtx.restore();
    });

    if (activeCount > 0) {
      confettiAnimationFrame = requestAnimationFrame(renderConfetti);
    }
  }

  cancelAnimationFrame(confettiAnimationFrame);
  renderConfetti();
}
