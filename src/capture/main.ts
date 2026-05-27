// @ts-nocheck
import '../capture.css';

const image = document.getElementById('screenImage');
const selectionEl = document.getElementById('selection');
const metaEl = document.getElementById('meta');

let startPoint = null;
let activeRect = null;
let isCompleting = false;

function normalizeRect(rect) {
  return {
    x: Math.min(rect.x, rect.x + rect.width),
    y: Math.min(rect.y, rect.y + rect.height),
    width: Math.abs(rect.width),
    height: Math.abs(rect.height)
  };
}

function renderSelection(rect) {
  const next = normalizeRect(rect);
  document.body.dataset.selecting = 'true';
  selectionEl.style.display = 'block';
  selectionEl.style.left = `${next.x}px`;
  selectionEl.style.top = `${next.y}px`;
  selectionEl.style.width = `${next.width}px`;
  selectionEl.style.height = `${next.height}px`;

  metaEl.style.display = 'inline-flex';
  metaEl.textContent = `${Math.round(next.width)} x ${Math.round(next.height)}`;
  metaEl.style.left = `${Math.min(window.innerWidth - 96, next.x + next.width + 8)}px`;
  metaEl.style.top = `${Math.min(window.innerHeight - 30, Math.max(8, next.y - 2))}px`;
}

async function finishSelection() {
  if (!activeRect || isCompleting) {
    return;
  }

  const next = normalizeRect(activeRect);
  if (next.width < 8 || next.height < 8) {
    activeRect = null;
    window.captureBridge.cancel();
    return;
  }

  isCompleting = true;
  document.body.dataset.capturing = 'true';

  try {
    await window.captureBridge.complete(next);
  } catch {
    window.captureBridge.cancel();
  }
}

window.captureBridge.onPrepare((payload) => {
  document.body.dataset.live = payload.live ? 'true' : 'false';

  if (payload.dataUrl) {
    document.body.dataset.hasImage = 'true';
    image.src = payload.dataUrl;
    return;
  }

  document.body.dataset.hasImage = 'false';
  image.removeAttribute('src');
});

window.addEventListener('mousedown', (event) => {
  if (isCompleting) {
    return;
  }

  if (event.button !== 0) {
    window.captureBridge.cancel();
    return;
  }

  startPoint = { x: event.clientX, y: event.clientY };
  activeRect = { x: startPoint.x, y: startPoint.y, width: 0, height: 0 };
  renderSelection(activeRect);
});

window.addEventListener('mousemove', (event) => {
  if (!startPoint || isCompleting) {
    return;
  }

  activeRect = {
    x: startPoint.x,
    y: startPoint.y,
    width: event.clientX - startPoint.x,
    height: event.clientY - startPoint.y
  };
  renderSelection(activeRect);
});

window.addEventListener('mouseup', () => {
  if (!startPoint || isCompleting) {
    return;
  }

  startPoint = null;
  finishSelection();
});

window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    window.captureBridge.cancel();
  }
});

window.addEventListener('contextmenu', (event) => {
  event.preventDefault();
  window.captureBridge.cancel();
});
