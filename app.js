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
const memberListContainer = document.getElementById('member-list-container');
const lblGroup = document.getElementById('lbl-group');
const lblMember = document.getElementById('lbl-member');

const popupModal = document.getElementById('popup-modal');
const popupMemberList = document.getElementById('popup-member-list');

let currentStream = null;
let currentFacingMode = 'environment';
let torchState = false;
let isDrawing = false;
let currentMode = 'pen';
let currentColor = '#ff0000';
let currentLineWidth = 16;
let currentUniqueCode = '';

let members = JSON.parse(localStorage.getItem('cheki_members') || JSON.stringify([
  { name: '担当 〇〇', color: '#ff007f' }
]));
let currentMemberIndex = parseInt(localStorage.getItem('cheki_curr_idx') || '0', 10);
if (currentMemberIndex >= members.length) currentMemberIndex = 0;

inputGroup.value = localStorage.getItem('cheki_group') || '';

// 緑色を明るく濃い鮮やかな緑にアップデート
const paletteData = [
  { color: '#ff0000', label: '赤' },
  { color: '#0000ff', label: '青' },
  { color: '#FFFF00', label: '黄' },
  { color: '#ff00ff', label: '紫' },
  { color: '#00cc44', label: '緑' }, // より明るく濃い緑
  { color: '#ff69b4', label: 'ピンク' },
  { color: '#00a86b', label: 'エメラルド' },
  { color: '#87ceeb', label: 'パステル' },
  { color: '#ffa500', label: 'オレンジ' },
  { color: '#ffffff', label: '白' },
  { color: '#000000', label: '黒' }
];

// 共通カラーパレット描画関数
function renderPalettes() {
  const container = document.getElementById('color-palette');
  if (!container) return;
  container.innerHTML = '';

  paletteData.forEach(item => {
    const div = document.createElement('div');
    div.className = `color-item ${currentColor === item.color ? 'selected' : ''}`;
    
    // 白・黒の境界線切れを見やすく調整
    const borderStyle = (item.color === '#ffffff' || item.color === '#000000') ? 'border: 2px solid #888;' : 'border: 2px solid #fff;';
    div.innerHTML = `
      <div class="color-chip" style="background: ${item.color}; ${borderStyle}"></div>
      <span class="color-label">${item.label}</span>
    `;
    div.addEventListener('click', () => {
      currentColor = item.color;
      currentMode = 'pen';
      renderPalettes();
    });
    container.appendChild(div);
  });

  // カスタムカラー
  const customDiv = document.createElement('div');
  customDiv.className = 'color-item';
  customDiv.style.position = 'relative';
  customDiv.innerHTML = `
    <input type="color" id="pen-custom-color" value="${currentColor}" style="width:22px; height:22px; padding:0; border:none; border-radius:50%; cursor:pointer; opacity:0; position:absolute; top:0; left:0;">
    <div class="color-chip" style="background: conic-gradient(red, yellow, green, cyan, blue, magenta, red); border: 2px solid #fff;"></div>
    <span class="color-label">自由</span>
  `;
  customDiv.querySelector('input').addEventListener('input', (e) => {
    currentColor = e.target.value;
    currentMode = 'pen';
    renderPalettes();
  });
  container.appendChild(customDiv);

  // 消しゴム
  const eraserBtn = document.createElement('button');
  eraserBtn.className = `btn-secondary ${currentMode === 'eraser' ? 'btn-active' : ''}`;
  eraserBtn.style.cssText = 'padding: 4px 6px; font-size: 9px; border-radius: 12px;';
  eraserBtn.textContent = '🧹消';
  eraserBtn.addEventListener('click', () => {
    currentMode = 'eraser';
    renderPalettes();
  });
  container.appendChild(eraserBtn);
}

// 設定画面のメンバー入力行構築
function renderMemberInputs() {
  memberListContainer.innerHTML = '';
  members.forEach((m, idx) => {
    const row = document.createElement('div');
    row.className = 'member-entry-box';
    row.innerHTML = `
      <div style="display: flex; gap: 6px; align-items: center;">
        <input type="text" class="m-name" value="${m.name}" placeholder="メンバー名" style="flex-grow:1;">
        <input type="color" class="m-color" value="${m.color}" style="width: 34px; height: 32px; padding:0; border:none; border-radius:4px; cursor:pointer;">
        <button class="btn-secondary btn-del-member" style="padding: 4px 8px; background: #d9534f;">✕</button>
      </div>
    `;
    row.querySelector('.btn-del-member').addEventListener('click', () => {
      if (members.length <= 1) {
        alert('最低1人のメンバーが必要です。');
        return;
      }
      members.splice(idx, 1);
      renderMemberInputs();
    });
    memberListContainer.appendChild(row);
  });
}

document.getElementById('btn-add-member-row').addEventListener('click', () => {
  members.push({ name: '新メンバー', color: '#ff69b4' });
  renderMemberInputs();
});

function updateHeaderLabels() {
  lblGroup.textContent = inputGroup.value;
  const currentMember = members[currentMemberIndex] || members[0];
  lblMember.textContent = currentMember.name;
  lblMember.style.color = currentMember.color;
  
  localStorage.setItem('cheki_group', inputGroup.value);
  localStorage.setItem('cheki_members', JSON.stringify(members));
  localStorage.setItem('cheki_curr_idx', currentMemberIndex);
}
updateHeaderLabels();
renderPalettes();

// 設定画面の開閉
document.getElementById('btn-open-settings').addEventListener('click', () => {
  renderMemberInputs();
  settingsModal.classList.remove('hidden');
});

document.getElementById('btn-close-settings').addEventListener('click', () => {
  const rows = memberListContainer.querySelectorAll('.member-entry-box');
  members = [];
  rows.forEach(row => {
    const name = row.querySelector('.m-name').value.trim() || '未設定';
    const color = row.querySelector('.m-color').value;
    members.push({ name, color });
  });
  if (currentMemberIndex >= members.length) currentMemberIndex = 0;

  updateHeaderLabels();
  settingsModal.classList.add('hidden');
});

lblMember.addEventListener('click', () => {
  popupMemberList.innerHTML = '';
  members.forEach((m, idx) => {
    const item = document.createElement('div');
    item.className = 'popup-item';
    item.style.color = m.color;
    item.textContent = m.name;
    if (idx === currentMemberIndex) item.style.border = '2px solid #ff69b4';
    
    item.addEventListener('click', () => {
      currentMemberIndex = idx;
      updateHeaderLabels();
      popupModal.classList.add('hidden');
    });
    popupMemberList.appendChild(item);
  });
  popupModal.classList.remove('hidden');
});

document.getElementById('btn-close-popup').addEventListener('click', () => {
  popupModal.classList.add('hidden');
});

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

async function initCamera() {
  if (currentStream) {
    currentStream.getTracks().forEach(track => track.stop());
  }
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    alert('このブラウザではカメラ機能がサポートされていません。');
    return;
  }
  try {
    const constraints = {
      video: { facingMode: { exact: currentFacingMode }, width: { ideal: 1080 }, height: { ideal: 1350 } },
      audio: false
    };
    currentStream = await navigator.mediaDevices.getUserMedia(constraints);
    video.srcObject = currentStream;
    zoomRange.value = 1;
    zoomSliderBox.classList.remove('hidden');
  } catch (err1) {
    try {
      const fallbackConstraints = { video: { facingMode: currentFacingMode }, audio: false };
      currentStream = await navigator.mediaDevices.getUserMedia(fallbackConstraints);
      video.srcObject = currentStream;
      zoomRange.value = 1;
      zoomSliderBox.classList.remove('hidden');
    } catch (err2) {
      try {
        currentStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        video.srcObject = currentStream;
        zoomRange.value = 1;
        zoomSliderBox.classList.remove('hidden');
      } catch (err3) {
        alert('カメラを起動できませんでした。');
        zoomSliderBox.classList.add('hidden');
      }
    }
  }
}
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

document.getElementById('btn-snap').addEventListener('click', () => {
  if (!video.videoWidth) {
    alert('カメラの映像がまだ準備できていません。');
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

  const currentMember = members[currentMemberIndex] || members[0];

  ctx.fillStyle = '#555555';
  ctx.font = 'bold 34px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(inputGroup.value, 60, 65);
  
  ctx.fillStyle = currentMember.color;
  ctx.textAlign = 'right';
  ctx.fillText(currentMember.name, 1020, 65);

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
  } else if (currentMode === 'sparkle') {
    drawEmoji('✨', x, y);
  } else if (currentMode === 'paw') {
    drawEmoji('🐾', x, y);
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
document.getElementById('btn-stamp-sparkle').addEventListener('click', () => currentMode = 'sparkle');
document.getElementById('btn-stamp-paw').addEventListener('click', () => currentMode = 'paw');

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
