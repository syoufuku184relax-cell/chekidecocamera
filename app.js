// PWA Service Worker 登録
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js');
}

const video = document.getElementById('webcam');
const canvas = document.getElementById('stage');
const ctx = canvas.getContext('2d');

const camTools = document.getElementById('cam-tools');
const choiceTools = document.getElementById('choice-tools');
const editTools = document.getElementById('edit-tools');
const penColorInput = document.getElementById('pen-color');

let isDrawing = false;
let currentMode = 'pen';
let currentUniqueCode = '';

// 1日の中で重複しない4桁のランダムな英数字を生成（ローカルストレージで当日分を管理）
function generateUniqueCode() {
  const todayStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  let storedData = JSON.parse(localStorage.getItem('cheki_codes') || '{}');
  
  if (storedData.date !== todayStr) {
    storedData = { date: todayStr, codes: [] };
  }

  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 紛らわしい文字(0, O, I, 1等)を除外
  let code = '';
  
  // 重複しない4桁を生成
  while (true) {
    code = '';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    if (!storedData.codes.includes(code)) {
      storedData.codes.push(code);
      localStorage.setItem('cheki_codes', JSON.stringify(storedData));
      break;
    }
  }
  return code;
}

// 現在の日付を取得 (例: 2026.06.07)
function getFormattedDate() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}.${m}.${d}`;
}

// 1. カメラ起動 (背面カメラ優先・4:5に近い解像度を狙う)
async function initCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: 1080, height: 1350 },
      audio: false
    });
    video.srcObject = stream;
  } catch (err) {
    alert('カメラの起動に失敗しました: ' + err.message);
  }
}
initCamera();

// 2. 撮影ボタン
document.getElementById('btn-snap').addEventListener('click', () => {
  currentUniqueCode = generateUniqueCode();
  
  // 1080x1350 のCanvas全体を「チェキ風白背景（#f4f4f4）」で塗りつぶす
  ctx.fillStyle = '#f4f4f4';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 写真エリア（上部: 1080x1180px）にカメラ映像を中央クロップ＆描画
  const vWidth = video.videoWidth;
  const vHeight = video.videoHeight;
  const targetW = 1080;
  const targetH = 1180;
  
  // cover形式で切り抜き計算
  const scale = Math.max(targetW / vWidth, targetH / vHeight);
  const sw = targetW / scale;
  const sh = targetH / scale;
  const sx = (vWidth - sw) / 2;
  const sy = (vHeight - sh) / 2;

  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, targetW, targetH);

  // 下部の白枠エリアに「日付（左下）」と「認識番号（右下）」をテキスト描画
  ctx.fillStyle = '#444444';
  ctx.font = 'bold 42px sans-serif';
  
  // 左下（日付）
  ctx.textAlign = 'left';
  ctx.fillText(getFormattedDate(), 60, 1285);

  // 右下（認識番号）
  ctx.textAlign = 'right';
  ctx.fillText(`#${currentUniqueCode}`, 1020, 1285);

  // 画面表示切替（撮影プレビュー非表示 ＆ Canvas表示 ＆ 選択肢ボタン表示）
  video.classList.add('hidden');
  canvas.style.display = 'block';
  camTools.classList.add('hidden');
  choiceTools.classList.remove('hidden');
});

// 3. 選択肢: 撮り直し
document.getElementById('btn-retake').addEventListener('click', () => {
  video.classList.remove('hidden');
  canvas.style.display = 'none';
  choiceTools.classList.add('hidden');
  camTools.classList.remove('hidden');
});

// 4. 選択肢: 保存して描画へ（端末に自動保存してからデコ画面へ）
document.getElementById('btn-save-and-draw').addEventListener('click', () => {
  autoSaveImage('raw');
  goToEditMode();
});

// 5. 選択肢: 保存しないで描画へ
document.getElementById('btn-skip-save-draw').addEventListener('click', () => {
  goToEditMode();
});

function goToEditMode() {
  choiceTools.classList.add('hidden');
  editTools.classList.remove('hidden');
}

// 6. デコレーション（手描き・スタンプ）ロジック
function getCanvasCoords(e) {
  const rect = canvas.getBoundingClientRect();
  const touch = e.touches ? e.touches[0] : e;
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: (touch.clientX - rect.left) * scaleX,
    y: (touch.clientY - rect.top) * scaleY
  };
}

function startDraw(e) {
  if (editTools.classList.contains('hidden')) return; // 編集モード中以外は無効
  const { x, y } = getCanvasCoords(e);
  
  if (currentMode === 'pen') {
    isDrawing = true;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.strokeStyle = penColorInput.value;
    ctx.lineWidth = 16;
    ctx.lineCap = 'round';
  } else if (currentMode === 'heart') {
    drawEmoji('❤️', x, y);
  } else if (currentMode === 'star') {
    drawEmoji('⭐', x, y);
  }
}

function moveDraw(e) {
  if (!isDrawing || currentMode !== 'pen') return;
  const { x, y } = getCanvasCoords(e);
  ctx.lineTo(x, y);
  ctx.stroke();
}

function endDraw() {
  isDrawing = false;
}

function drawEmoji(emoji, x, y) {
  ctx.font = '100px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(emoji, x, y);
}

// イベント登録
canvas.addEventListener('mousedown', startDraw);
canvas.addEventListener('mousemove', moveDraw);
canvas.addEventListener('mouseup', endDraw);
canvas.addEventListener('touchstart', (e) => { e.preventDefault(); startDraw(e); });
canvas.addEventListener('touchmove', (e) => { e.preventDefault(); moveDraw(e); });
canvas.addEventListener('touchend', endDraw);

// ツールボタン切替
document.getElementById('pen-color').addEventListener('change', () => currentMode = 'pen');
document.getElementById('btn-stamp-heart').addEventListener('click', () => currentMode = 'heart');
document.getElementById('btn-stamp-star').addEventListener('click', () => currentMode = 'star');

// リセット（撮影直後の状態に戻す）
document.getElementById('btn-clear').addEventListener('click', () => {
  // 再度スナップショット部分だけを再描画するのは複雑なため、
  // シンプルにするなら「撮り直し」へ戻すか、保持データを元に再描画する設計にします。
  alert('リセットするには一度「撮り直し」を行ってください。');
});

// 編集画面から選択肢に戻る
document.getElementById('btn-back-choice').addEventListener('click', () => {
  editTools.classList.add('hidden');
  choiceTools.classList.remove('hidden');
});

// 自動保存用関数
function autoSaveImage(suffix) {
  const link = document.createElement('a');
  link.download = `cheki_${getFormattedDate().replace(/\./g, '')}_${currentUniqueCode}_${suffix}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

// 7. 最終保存（デコ完了後）
document.getElementById('btn-final-save').addEventListener('click', () => {
  autoSaveImage('decorated');
  alert('画像を保存しました！');
});
