/* =======================================================================
   1. GAME CONFIGURATION & STATE MANAGEMENT
   ======================================================================= */
const BOARD_SIZE = 19; // Chuẩn 19x19
const EMPTY = 0;
const PLAYER_X = 1; // Đi trước
const PLAYER_O = 2; // Đi sau

const DIRECTIONS = [
  [0, 1],   // Ngang
  [1, 0],   // Dọc
  [1, 1],   // Chéo chính \
  [1, -1]   // Chéo phụ /
];

let board = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(EMPTY));
let moveHistory = []; // Lưu danh sách các nước đi [{r, c, player}]
let currentPlayer = PLAYER_X;
let gameOver = false;
let winningLine = null; // Mảng 5 tọa độ [{r, c}] khi thắng
let hoveredCell = null; // {r, c} cho con trỏ chuột/chạm

// Cài đặt chế độ: 'pve', 'pvp', 'blitz', 'tower', 'puzzle', 'go'
let gameMode = 'pve';
let aiDifficulty = 'medium'; // 'easy', 'medium', 'hard', 'hell'
let humanSide = PLAYER_X; // Người là X hay O
let isAiThinking = false;

// Điểm số ván đấu
let score = { X: 0, O: 0, draws: 0 };
let soundEnabled = true;

// --- DỮ LIỆU TỰ HỌC 118+ BÀI HỌC TỪ CÁC TRẬN THUA LỊCH SỬ ---
const INITIAL_MASTER_BRAIN = {
  "9,9": 800000, "9,10": 750000, "10,9": 750000, "8,9": 750000, "9,8": 750000,
  "8,8": 700000, "10,10": 700000, "8,10": 700000, "10,8": 700000,
  "7,7": 650000, "7,8": 650000, "7,9": 650000, "7,10": 650000, "7,11": 650000,
  "8,7": 650000, "9,7": 650000, "10,7": 650000, "11,7": 650000,
  "11,11": 650000, "11,10": 650000, "11,9": 650000, "11,8": 650000,
  "8,11": 650000, "9,11": 650000, "10,11": 650000,
  "6,6": 550000, "6,7": 550000, "6,8": 550000, "6,9": 550000, "6,10": 550000, "6,11": 550000, "6,12": 550000,
  "12,6": 550000, "12,7": 550000, "12,8": 550000, "12,9": 550000, "12,10": 550000, "12,11": 550000, "12,12": 550000,
  "5,5": 500000, "5,6": 500000, "5,7": 500000, "5,8": 500000, "5,9": 500000, "5,10": 500000, "5,11": 500000, "5,12": 500000, "5,13": 500000,
  "13,5": 500000, "13,6": 500000, "13,7": 500000, "13,8": 500000, "13,9": 500000, "13,10": 500000, "13,11": 500000, "13,12": 500000, "13,13": 500000,
  "4,4": 450000, "4,5": 450000, "4,6": 450000, "4,7": 450000, "4,8": 450000, "4,9": 450000, "4,10": 450000, "4,11": 450000, "4,12": 450000, "4,13": 450000, "4,14": 450000,
  "14,4": 450000, "14,5": 450000, "14,6": 450000, "14,7": 450000, "14,8": 450000, "14,9": 450000, "14,10": 450000, "14,11": 450000, "14,12": 450000, "14,13": 450000, "14,14": 450000,
  "3,3": 400000, "3,9": 400000, "3,15": 400000, "9,3": 400000, "9,15": 400000, "15,3": 400000, "15,9": 400000, "15,15": 400000,
  "7,12": 400000, "8,12": 400000, "9,12": 400000, "10,12": 400000, "11,12": 400000,
  "12,5": 400000, "12,13": 400000, "6,5": 400000, "6,13": 400000,
  "7,6": 400000, "8,6": 400000, "9,6": 400000, "10,6": 400000, "11,6": 400000,
  "5,14": 350000, "13,14": 350000, "14,5": 350000, "14,13": 350000,
  "2,2": 300000, "2,9": 300000, "2,16": 300000, "9,2": 300000, "9,16": 300000, "16,2": 300000, "16,9": 300000, "16,16": 300000,
  "1,1": 250000, "1,9": 250000, "1,17": 250000, "9,1": 250000, "9,17": 250000, "17,1": 250000, "17,9": 250000, "17,17": 250000
};

// Khởi tạo trí nhớ AI kết hợp dữ liệu tự học 118+ bài học
let aiBrain = { ...INITIAL_MASTER_BRAIN };
try {
  const storedBrain = JSON.parse(localStorage.getItem('caro_ai_brain_v2') || '{}');
  aiBrain = { ...INITIAL_MASTER_BRAIN, ...storedBrain };
} catch (e) {
  aiBrain = { ...INITIAL_MASTER_BRAIN };
}

// --- CỜ CHỚP (BLITZ MODE) ---
let blitzTimer = null;
let blitzTimeLeft = 10;

// --- VƯỢT THÁP BOSS AI (TOWER SURVIVAL) ---
let currentTowerStage = 1;
let maxTowerUnlocked = parseInt(localStorage.getItem('caro_tower_max') || '1');

const TOWER_STAGES = [
  { stage: 1, bossName: "Boss Tầng 1: Tân Thủ", diff: "easy", side: PLAYER_X },
  { stage: 2, bossName: "Boss Tầng 2: Chiến Thuật", diff: "medium", side: PLAYER_X },
  { stage: 3, bossName: "Boss Tầng 3: Đại Cờ Thủ 🔥", diff: "hard", side: PLAYER_X },
  { stage: 4, bossName: "Boss Tầng 4: Ma Vương 💀", diff: "hell", side: PLAYER_X },
  { stage: 5, bossName: "Boss Tầng 5: Hủy Diệt (Boss Cuối)", diff: "hell", side: PLAYER_O }
];

// --- GIẢI ĐỐ THẾ CỜ VCF (PUZZLE MODE) ---
let currentPuzzleIndex = 0;
let maxPuzzleUnlocked = parseInt(localStorage.getItem('caro_puzzle_max') || '0');

const PUZZLES = [
  {
    id: 1,
    title: "Thế 1: Chốt Hạ 5 Quân",
    desc: "Tìm 1 nước duy nhất để hoàn thành chuỗi 5 quân X!",
    board: [
      { r: 7, c: 5, p: PLAYER_X }, { r: 7, c: 6, p: PLAYER_X }, { r: 7, c: 7, p: PLAYER_X }, { r: 7, c: 8, p: PLAYER_X },
      { r: 6, c: 6, p: PLAYER_O }, { r: 8, c: 7, p: PLAYER_O }
    ],
    humanPlayer: PLAYER_X,
    hint: "Tìm ô thứ 5 ở 2 đầu hàng ngang 7!"
  },
  {
    id: 2,
    title: "Thế 2: Gài 4 Mở 2 Đầu",
    desc: "Đánh vào ô tạo 4 mở 2 đầu để chắc chắn thắng nước sau!",
    board: [
      { r: 7, c: 6, p: PLAYER_X }, { r: 7, c: 7, p: PLAYER_X }, { r: 7, c: 8, p: PLAYER_X },
      { r: 5, c: 5, p: PLAYER_O }, { r: 8, c: 8, p: PLAYER_O }, { r: 9, c: 9, p: PLAYER_O }
    ],
    humanPlayer: PLAYER_X,
    hint: "Đánh vào đầu hàng 7 (ô Cột 5 hoặc Cột 9)!"
  },
  {
    id: 3,
    title: "Thế 3: Gọng Kìm Nước Đôi 3-3",
    desc: "Tìm giao điểm tạo 2 đường 3 mở khiến đối phương không thể cản!",
    board: [
      { r: 7, c: 6, p: PLAYER_X }, { r: 7, c: 7, p: PLAYER_X },
      { r: 5, c: 8, p: PLAYER_X }, { r: 6, c: 8, p: PLAYER_X },
      { r: 4, c: 4, p: PLAYER_O }, { r: 8, c: 10, p: PLAYER_O }
    ],
    humanPlayer: PLAYER_X,
    hint: "Giao điểm Hàng 7 và Cột 8 chính là điểm chốt!"
  },
  {
    id: 4,
    title: "Thế 4: Giải Cứu & Lật Kèo",
    desc: "Máy sắp thắng với đòn 4-3. Hãy chặn đúng ô nguy hiểm để mở đường phản công!",
    board: [
      { r: 6, c: 5, p: PLAYER_O }, { r: 6, c: 6, p: PLAYER_O }, { r: 6, c: 7, p: PLAYER_O },
      { r: 5, c: 8, p: PLAYER_O }, { r: 7, c: 8, p: PLAYER_O },
      { r: 8, c: 5, p: PLAYER_X }, { r: 8, c: 6, p: PLAYER_X }, { r: 8, c: 7, p: PLAYER_X }
    ],
    humanPlayer: PLAYER_X,
    hint: "Chặn ngay ô (6,8) vừa hóa giải đòn gài vừa tạo 4 mở cho bạn!"
  },
  {
    id: 5,
    title: "Thế 5: VCF Chuỗi Buộc Chặn",
    desc: "Dùng chuỗi VCF gài 4 liên tục để ép máy đỡ và chốt hạ chiến thắng!",
    board: [
      { r: 7, c: 5, p: PLAYER_X }, { r: 7, c: 6, p: PLAYER_X }, { r: 7, c: 7, p: PLAYER_X },
      { r: 5, c: 8, p: PLAYER_X }, { r: 6, c: 8, p: PLAYER_X },
      { r: 4, c: 4, p: PLAYER_O }, { r: 9, c: 9, p: PLAYER_O }
    ],
    humanPlayer: PLAYER_X,
    hint: "Đánh ô (7,8) để tạo 4 liên tiếp!"
  }
];
