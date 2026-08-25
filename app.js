if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js');
}

const video = document.getElementById('webcam');
const canvas = document.getElementById('stage');
const ctx = canvas.getContext('2d');

const camTools = document.getElementById('cam-tools');
const choiceTools = document.getElementById('choice-tools');
const editTools = document.getElementById('edit-tools');
const zoomSliderBox = document.getElementById('zoom-slider-box');
const zoomRange = document.getElementById('zoom-range');

const settingsModal = document.getElementById('settings-modal');
const inputGroup = document.getElementById('input-group');
const inputMember = document.getElementById('input-member');
const inputMemberColor = document.getElementById('input-member-color');
const lblGroup = document.getElementById('lbl-group');
const lblMember = document.getElementById('lbl-member');

let currentStream = null;
let currentFacingMode = 'environment';
let torchState = false;
let isDrawing = false;
let currentMode = 'pen';
let currentColor = '#ff0000';
let currentLineWidth = 16;
let currentUniqueCode = '';

// ローカルストレージから設定復元
inputGroup.value = localStorage.getItem('cheki_group') || '';
inputMember.value = localStorage.getItem('cheki_member') || '';
inputMemberColor.value = localStorage.getItem('cheki_mcolor') || '#ff007f';

function updateHeaderLabels() {
  lblGroup.textContent = inputGroup.value;
  lblMember.textContent = inputMember.value;
  lblMember.style.color = inputMemberColor.value;
  
  localStorage.setItem('cheki_group', inputGroup.value);
  localStorage.setItem('cheki_member', inputMember.value);
  localStorage.setItem('cheki_mcolor', inputMemberColor.value);
}
updateHeaderLabels();

// 設定画面の開閉
document.getElementById('btn-open-settings').addEventListener('click', () => {
  settingsModal.classList.remove('hidden');
});
document.getElementById('btn-close-settings').addEventListener('click', () => {
  updateHeaderLabels();
  settingsModal.classList.add('hidden');
});

// 4桁の重複なし番号生成
function generateUniqueCode() {
  const todayStr = new Date().toISOString().slice(0, 10);
  let storedData = JSON.parse(localStorage.getItem('cheki_codes') || '{}');
  if (storedData.date !== todayStr) storedData = { date: todayStr, codes: [] };

  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  while (true) {
    code = '';
    for (let i = 0; i < 4; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
    if (!storedData.codes.includes(code)) {
      storedData.codes.push(code);
      localStorage.setItem('cheki_codes', JSON.stringify(storedData));
      break;
    }
  }
  return code;
}

function getFormattedDate() {
  const now = new Date();
  return `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}`;
}

// カメラ初期化処理の堅牢化
async function initCamera() {
  if (currentStream) {
    currentStream.getTracks().forEach(track => track.stop());
  }

  // セキュアコンテキスト（HTTPSやlocalhost）のチェック
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    alert('このブラウザまたは接続環境（HTTPS非対応など）ではカメラ機能がサポートされていません。');
    return;
  }

  try {
    // 1. まず厳密な条件で試す
    const constraints = {
      video: { facingMode: { exact: currentFacingMode }, width: { ideal: 1080 }, height: { ideal: 1350 } },
      audio: false
    };
    currentStream = await navigator.mediaDevices.getUserMedia(constraints);
    video.srcObject = currentStream;
    zoomRange.value = 1;
    zoomSliderBox.classList.remove('hidden');
  } catch (err1) {
    console.warn('厳密なカメラ取得に失敗、フォールバックを試みます:', err1);
    try {
      // 2. 厳密指定を解除したフォールバック
      const fallbackConstraints = {
        video: { facingMode: currentFacingMode },
        audio: false
      };
      currentStream = await navigator.mediaDevices.getUserMedia(fallbackConstraints);
      video.srcObject = currentStream;
      zoomRange.value = 1;
      zoomSliderBox.classList.remove('hidden');
    } catch (err2) {
      console.warn('通常フォールバックも失敗、制約なしで再試行:', err2);
      try {
        // 3. 完全な制約なし（最低限のカメラ）
        currentStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        video.srcObject = currentStream;
        zoomRange.value = 1;
        zoomSliderBox.classList.remove('hidden');
      } catch (err3) {
        alert('カメラを起動できませんでした。ブラウザのカメラ権限が許可されているか、他のアプリがカメラを使用していないか確認してください。');
        zoomSliderBox.classList.add('hidden');
      }
    }
  }
}

// 読み込み時に実行
initCamera();

document.getElementById('btn-flip').addEventListener('click', () => {
  currentFacingMode = (currentFacingMode === 'environment') ? 'user' : 'environment';
  initCamera();
});

document.getElementById('btn-torch').addEventListener('click', async () => {
  const track = currentStream?.getVideoTracks()[0];
  if (!track) return;
  try {
    torchState = !torchState;
    await track.applyConstraints({ advanced: [{ torch: torchState }] });
    document.getElementById('btn-torch').style.background = torchState ? '#28a745' : '#ffc107';
  } catch (err) {
    alert('お使いの端末・カメラではライト制御がサポートされていません。');
    torchState = !torchState;
  }
});

zoomRange.addEventListener('input', (e) => {
  const track = currentStream?.getVideoTracks()[0];
  if (!track) return;
  try {
    const capabilities = track.getCapabilities();
    if (capabilities.zoom) {
      track.applyConstraints({ advanced: [{ zoom: parseFloat(e.target.value) }] });
    } else {
      video.style.transform = `scale(${e.target.value})`;
    }
  } catch (err) {
    video.style.transform = `scale(${e.target.value})`;
  }
});

// 撮影処理
document.getElementById('btn-snap').addEventListener('click', () => {
  if (!video.videoWidth) {
    alert('カメラの映像がまだ準備できていません。少し待ってから再度お試しください。');
    return;
  }

  currentUniqueCode = generateUniqueCode();
  
  ctx.fillStyle = '#fdfdfd';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const vWidth = video.videoWidth;
  const vHeight = video.videoHeight;
  const targetW = 1080;
  const targetH = 1200;
  
  const scale = Math.max(targetW / vWidth, targetH / vHeight);
  const sw = targetW / scale;
  const sh = targetH / scale;
  const sx = (vWidth - sw) / 2;
  const sy = (vHeight - sh) / 2;

  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, targetW, targetH);

  // 上部テキスト
  ctx.fillStyle = '#555555';
  ctx.font = 'bold 34px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(inputGroup.value, 60, 65);
  
  ctx.fillStyle = inputMemberColor.value;
  ctx.textAlign = 'right';
  ctx.fillText(inputMember.value, 1020, 65);

  // 下部テキスト
  ctx.fillStyle = '#444444';
  ctx.font = 'bold 36px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(getFormattedDate(), 60, 1315);

  ctx.textAlign = 'right';
  ctx.fillText(`#${currentUniqueCode}`, 1020, 1315);

  video.classList.add('hidden');
  zoomSliderBox.classList.add('hidden');
  canvas.style.display = 'block';
  camTools.classList.add('hidden');
  choiceTools.classList.remove('hidden');
});

document.getElementById('btn-retake').addEventListener('click', () => {
  video.classList.remove('hidden');
  zoomSliderBox.classList.remove('hidden');
  canvas.style.display = 'none';
  choiceTools.classList.add('hidden');
  camTools.classList.remove('hidden');
});

document.getElementById('btn-save-and-draw').addEventListener('click', () => {
  autoSaveImage('raw');
  goToEditMode();
});

document.getElementById('btn-skip-save-draw').addEventListener('click', () => {
  goToEditMode();
});

function goToEditMode() {
  choiceTools.classList.add('hidden');
  editTools.classList.remove('hidden');
}

// カラーパレット選択
const colorItems = document.querySelectorAll('.color-item');
colorItems.forEach(item => {
  item.addEventListener('click', (e) => {
    const color = item.getAttribute('data-color');
    if (!color) return;
    colorItems.forEach(i => i.classList.remove('selected'));
    item.classList.add('selected');
    currentColor = color;
    currentMode = 'pen';
    document.getElementById('btn-eraser').classList.remove('btn-active');
  });
});

document.getElementById('pen-custom-color').addEventListener('input', (e) => {
  colorItems.forEach(i => i.classList.remove('selected'));
  currentColor = e.target.value;
  currentMode = 'pen';
  document.getElementById('btn-eraser').classList.remove('btn-active');
});

document.getElementById('btn-eraser').addEventListener('click', () => {
  currentMode = 'eraser';
  colorItems.forEach(i => i.classList.remove('selected'));
  document.getElementById('btn-eraser').classList.add('btn-active');
});

// 太さボタン
const sizeThin = document.getElementById('size-thin');
const sizeMid = document.getElementById('size-mid');
const sizeThick = document.getElementById('size-thick');

function updateSizeButtons(selectedBtn, width) {
  [sizeThin, sizeMid, sizeThick].forEach(btn => {
    btn.classList.remove('btn-active');
    btn.classList.add('btn-secondary');
  });
  selectedBtn.classList.remove('btn-secondary');
  selectedBtn.classList.add('btn-active');
  currentLineWidth = width;
}

sizeThin.addEventListener('click', () => updateSizeButtons(sizeThin, 8));
sizeMid.addEventListener('click', () => updateSizeButtons(sizeMid, 16));
sizeThick.addEventListener('click', () => updateSizeButtons(sizeThick, 32));

// 描画ロジック
function getCanvasCoords(e) {
  const rect = canvas.getBoundingClientRect();
  const touch = e.touches ? e.touches[0] : e;
  return {
    x: (touch.clientX - rect.left) * (canvas.width / rect.width),
    y: (touch.clientY - rect.top) * (canvas.height / rect.height)
  };
}

function startDraw(e) {
  if (editTools.classList.contains('hidden')) return;
  const { x, y } = getCanvasCoords(e);
  
  if (currentMode === 'pen' || currentMode === 'eraser') {
    isDrawing = true;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = currentLineWidth;
    ctx.strokeStyle = (currentMode === 'eraser') ? '#fdfdfd' : currentColor;
  } else if (currentMode === 'heart') {
    drawEmoji('❤️', x, y);
  } else if (currentMode === 'star') {
    drawEmoji('⭐', x, y);
  }
}

function moveDraw(e) {
  if (!isDrawing || (currentMode !== 'pen' && currentMode !== 'eraser')) return;
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

canvas.addEventListener('mousedown', startDraw);
canvas.addEventListener('mousemove', moveDraw);
canvas.addEventListener('mouseup', endDraw);
canvas.addEventListener('touchstart', (e) => { e.preventDefault(); startDraw(e); }, { passive: false });
canvas.addEventListener('touchmove', (e) => { e.preventDefault(); moveDraw(e); }, { passive: false });
canvas.addEventListener('touchend', endDraw);

document.getElementById('btn-stamp-heart').addEventListener('click', () => currentMode = 'heart');
document.getElementById('btn-stamp-star').addEventListener('click', () => currentMode = 'star');

document.getElementById('btn-back-choice').addEventListener('click', () => {
  editTools.classList.add('hidden');
  choiceTools.classList.remove('hidden');
});

function autoSaveImage(suffix) {
  const link = document.createElement('a');
  link.download = `cheki_${getFormattedDate().replace(/\./g, '')}_${currentUniqueCode}_${suffix}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

document.getElementById('btn-final-save').addEventListener('click', () => {
  autoSaveImage('decorated');
  alert('画像を保存しました！');
});
