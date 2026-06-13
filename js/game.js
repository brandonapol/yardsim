// ============================================================
//  YardSim — Phase 1: Map, Zones, Grid, Chickens
// ============================================================

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// ---- State ----
let zones = loadZones();
let chickens = [];
let lastTimestamp = 0;

const viewport = { x: 0, y: 0, zoom: 1 };
const MIN_ZOOM = 0.35;
const MAX_ZOOM = 6;

// Placed items — empty for now, populated in Phase 2
let placedItems = [];

// ---- Persistence ----
const STATE_KEY = 'yardsim_state';
const STATE_VERSION = 1;
let _saveTimer = null;

function loadGameState() {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (!raw) return;
    const state = JSON.parse(raw);
    if (state.version !== STATE_VERSION) return;
    // Restore viewport
    if (state.viewport) {
      viewport.x    = state.viewport.x;
      viewport.y    = state.viewport.y;
      viewport.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, state.viewport.zoom));
    }
    // Restore placed items (Phase 2+)
    if (Array.isArray(state.placedItems)) {
      placedItems = state.placedItems;
    }
  } catch (e) {
    console.warn('Could not restore game state:', e);
  }
}

function saveGameState() {
  const state = {
    version: STATE_VERSION,
    viewport: { x: viewport.x, y: viewport.y, zoom: viewport.zoom },
    placedItems,
    lastSaved: new Date().toISOString()
  };
  localStorage.setItem(STATE_KEY, JSON.stringify(state));
  _lastSavedAt = Date.now();
}

// Debounce saves so rapid pan/zoom doesn't hammer localStorage
function scheduleSave() {
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(saveGameState, 400);
}

let _lastSavedAt = 0;

const layers = {
  sunZones: true,
  grid: true,
  gardenOutlines: true,
  propertyOutline: true
};

// px per world-foot (for spacing math later; tunable)
// Property ≈ 250ft wide, image ≈ 620px across the property → ~2.5 px/ft
const PX_PER_FOOT = 2.5;
const GRID_FEET_COARSE = 8;  // grid cell size for general yard
const GRID_FEET_FINE   = 4;  // grid cell inside garden beds
const GRID_PX_COARSE   = GRID_FEET_COARSE * PX_PER_FOOT; // 20px
const GRID_PX_FINE     = GRID_FEET_FINE   * PX_PER_FOOT; // 10px

// ---- Zone Editor State ----
const editor = {
  active: false,
  targetZoneId: null, // 'property' | garden id | null
  newPoints: [],
  dragPointIdx: -1,
  hoveredPointIdx: -1,
  mode: 'select' // 'select' | 'add' | 'drag'
};

// ---- Input State ----
const mouse = { x: 0, y: 0, down: false, lastX: 0, lastY: 0 };

// ============================================================
//  COORDINATE TRANSFORMS
// ============================================================

function worldToCanvas(wx, wy) {
  return [wx * viewport.zoom + viewport.x, wy * viewport.zoom + viewport.y];
}

function canvasToWorld(cx, cy) {
  return [(cx - viewport.x) / viewport.zoom, (cy - viewport.y) / viewport.zoom];
}

// ============================================================
//  INIT
// ============================================================

function init() {
  resizeCanvas();
  fitImageToWindow();
  loadGameState();
  spawnChickens(3);
  setupInput();
  setupUI();
  requestAnimationFrame(gameLoop);
}

// World space is 954×972 (matches original satellite image dimensions)
const WORLD_W = 954;
const WORLD_H = 972;

function fitImageToWindow() {
  const scaleX = (window.innerWidth  - 280) / WORLD_W;
  const scaleY = (window.innerHeight - 60)  / WORLD_H;
  viewport.zoom = Math.min(scaleX, scaleY, 1);
  viewport.x = 40;
  viewport.y = 30;
  resizeCanvas();
}

function resizeCanvas() {
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
}

function spawnChickens(n) {
  chickens = [];
  const pts = zones.property.points;
  const bb  = getBoundingBox(pts);
  let placed = 0;
  let tries  = 0;
  while (placed < n && tries < 500) {
    tries++;
    const x = bb.minX + Math.random() * (bb.maxX - bb.minX);
    const y = bb.minY + Math.random() * (bb.maxY - bb.minY);
    const inGarden = zones.gardens.some(g => pointInPolygon(x, y, g.points));
    if (pointInPolygon(x, y, pts) && !inGarden) {
      const c = new Chicken(x, y, zones);
      c.stateTimer = placed * 1.2 + Math.random() * 2;
      chickens.push(c);
      placed++;
    }
  }
}

// ============================================================
//  GAME LOOP
// ============================================================

function gameLoop(timestamp) {
  const dt = Math.min((timestamp - lastTimestamp) / 1000, 0.1);
  lastTimestamp = timestamp;

  update(dt);
  render();
  requestAnimationFrame(gameLoop);
}

function update(dt) {
  if (!editor.active) {
    chickens.forEach(c => {
      c.zones = zones; // keep reference current
      c.update(dt);
    });
  }
}

// ============================================================
//  RENDER
// ============================================================

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Background fill (in case image doesn't cover everything)
  ctx.fillStyle = '#3d5e3a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.translate(viewport.x, viewport.y);
  ctx.scale(viewport.zoom, viewport.zoom);

  drawTerrain(ctx, viewport, zones, canvas.width, canvas.height);

  if (layers.sunZones)      drawSunZones();
  if (layers.grid)          drawGrid();
  if (layers.gardenOutlines) drawGardenBeds();
  if (layers.propertyOutline) drawPropertyOutline();

  chickens.forEach(c => c.draw(ctx));

  if (editor.active) drawEditorOverlay();

  ctx.restore();

  drawScreenUI();
}


function drawSunZones() {
  const pts = zones.property.points;
  const bb  = getBoundingBox(pts);
  const W   = bb.maxX - bb.minX;
  const H   = bb.maxY - bb.minY;

  ctx.save();
  // Clip to property
  applyPropertyClip();

  // Full sun: SE corner — warm golden radial gradient
  const seX = bb.minX + W * 0.75;
  const seY = bb.minY + H * 0.75;
  const sunGrad = ctx.createRadialGradient(seX, seY, 0, seX, seY, W * 0.65);
  sunGrad.addColorStop(0,   'rgba(255, 210, 50, 0.30)');
  sunGrad.addColorStop(0.5, 'rgba(255, 210, 50, 0.14)');
  sunGrad.addColorStop(1,   'rgba(255, 210, 50, 0)');
  ctx.fillStyle = sunGrad;
  ctx.fillRect(bb.minX, bb.minY, W, H);

  // Full shade: SW corner — cool green radial gradient
  const swX = bb.minX + W * 0.15;
  const swY = bb.minY + H * 0.75;
  const shadeGrad = ctx.createRadialGradient(swX, swY, 0, swX, swY, W * 0.60);
  shadeGrad.addColorStop(0,   'rgba(40, 90, 50, 0.32)');
  shadeGrad.addColorStop(0.5, 'rgba(40, 90, 50, 0.15)');
  shadeGrad.addColorStop(1,   'rgba(40, 90, 50, 0)');
  ctx.fillStyle = shadeGrad;
  ctx.fillRect(bb.minX, bb.minY, W, H);

  ctx.restore();
}

function drawGrid() {
  const pts = zones.property.points;
  const bb  = getBoundingBox(pts);

  ctx.save();
  applyPropertyClip();

  // Coarse yard grid
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.13)';
  ctx.lineWidth = 0.6 / viewport.zoom;
  drawGridLines(bb, GRID_PX_COARSE);

  ctx.restore();

  // Fine grid inside each garden bed (drawn separately with its own clip)
  zones.gardens.forEach(garden => {
    ctx.save();
    applyPolygonClip(garden.points);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.30)';
    ctx.lineWidth = 0.5 / viewport.zoom;
    drawGridLines(bb, GRID_PX_FINE);
    // Overlay: slight garden-bed grid tint
    ctx.fillStyle = 'rgba(100, 200, 100, 0.04)';
    ctx.fillRect(bb.minX, bb.minY, bb.maxX - bb.minX, bb.maxY - bb.minY);
    ctx.restore();
  });
}

function drawGridLines(bb, cellSize) {
  const startX = Math.floor(bb.minX / cellSize) * cellSize;
  const startY = Math.floor(bb.minY / cellSize) * cellSize;
  ctx.beginPath();
  for (let x = startX; x <= bb.maxX; x += cellSize) {
    ctx.moveTo(x, bb.minY);
    ctx.lineTo(x, bb.maxY);
  }
  for (let y = startY; y <= bb.maxY; y += cellSize) {
    ctx.moveTo(bb.minX, y);
    ctx.lineTo(bb.maxX, y);
  }
  ctx.stroke();
}

function drawGardenBeds() {
  zones.gardens.forEach(garden => {
    drawPolygon(garden.points, garden.fillColor, garden.strokeColor, garden.lineWidth / viewport.zoom);
    // Label
    const bb = getBoundingBox(garden.points);
    const cx = (bb.minX + bb.maxX) / 2;
    const cy = (bb.minY + bb.maxY) / 2;
    drawWorldLabel(cx, cy, garden.label, '#ffffff', 10 / viewport.zoom);
  });
}

function drawPropertyOutline() {
  // Chunky, slightly hand-drawn feel: draw twice — shadow then outline
  ctx.save();
  ctx.globalAlpha = 0.25;
  ctx.strokeStyle = '#000';
  ctx.lineWidth = (zones.property.lineWidth + 4) / viewport.zoom;
  ctx.setLineDash([]);
  tracePoly(zones.property.points);
  ctx.stroke();
  ctx.restore();

  ctx.globalAlpha = 1;
  ctx.strokeStyle = zones.property.strokeColor;
  ctx.lineWidth = zones.property.lineWidth / viewport.zoom;
  ctx.setLineDash([12 / viewport.zoom, 5 / viewport.zoom]);
  tracePoly(zones.property.points);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawPolygon(points, fill, stroke, lineWidth) {
  ctx.save();
  tracePoly(points);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth || 2 / viewport.zoom;
    ctx.stroke();
  }
  ctx.restore();
}

function tracePoly(points) {
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
  ctx.closePath();
}

function applyPropertyClip() {
  tracePoly(zones.property.points);
  ctx.clip();
}

function applyPolygonClip(points) {
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
  ctx.closePath();
  ctx.clip();
}

function drawWorldLabel(wx, wy, text, color, size) {
  ctx.save();
  ctx.font = `${size}px 'Fredoka One', sans-serif`;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 4 / viewport.zoom;
  ctx.fillText(text, wx, wy);
  ctx.restore();
}

// ============================================================
//  ZONE EDITOR OVERLAY
// ============================================================

function drawEditorOverlay() {
  const pts = editor.newPoints;
  if (!pts.length) return;

  // Draw in-progress polygon
  ctx.save();
  ctx.strokeStyle = '#ffdd00';
  ctx.lineWidth = 2 / viewport.zoom;
  ctx.setLineDash([6 / viewport.zoom, 3 / viewport.zoom]);
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  pts.forEach(p => ctx.lineTo(p[0], p[1]));
  if (pts.length > 2) {
    // Ghost close line
    ctx.save();
    ctx.globalAlpha = 0.4;
    ctx.lineTo(pts[0][0], pts[0][1]);
    ctx.restore();
  }
  ctx.stroke();
  ctx.setLineDash([]);

  // Draw handles
  pts.forEach((p, i) => {
    ctx.beginPath();
    ctx.arc(p[0], p[1], 6 / viewport.zoom, 0, Math.PI * 2);
    ctx.fillStyle = i === editor.hoveredPointIdx ? '#ffdd00' : '#fff';
    ctx.fill();
    ctx.strokeStyle = '#ff8800';
    ctx.lineWidth = 1.5 / viewport.zoom;
    ctx.stroke();
    // Index label
    ctx.font = `${9 / viewport.zoom}px monospace`;
    ctx.fillStyle = '#222';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(i, p[0], p[1]);
  });
  ctx.restore();
}

// ============================================================
//  SCREEN-SPACE UI
// ============================================================

function drawScreenUI() {
  // Corner labels for sun zones
  if (layers.sunZones) {
    drawCornerBadge(canvas.width - 160, canvas.height - 60, '☀️  Full Sun', '#ffe57a', '#7a5900');
    drawCornerBadge(160, canvas.height - 60, '🌿 Full Shade', '#b8e0b0', '#1b4d20');
  }

  // Bottom-left status line
  ctx.save();
  ctx.font = '11px monospace';
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.textAlign = 'left';
  const savedAgo = _lastSavedAt ? Math.round((Date.now() - _lastSavedAt) / 1000) : null;
  const savedLabel = savedAgo === null ? '' : savedAgo < 5 ? '  ·  saved' : `  ·  saved ${savedAgo}s ago`;
  ctx.fillText(`zoom ${viewport.zoom.toFixed(2)}x${savedLabel}`, 10, canvas.height - 10);
  ctx.restore();

  // Mouse world coordinates (bottom-right)
  const [mwx, mwy] = canvasToWorld(mouse.x, mouse.y);
  ctx.save();
  ctx.font = '11px monospace';
  ctx.fillStyle = 'rgba(255,255,255,0.50)';
  ctx.textAlign = 'right';
  ctx.fillText(`world [${Math.round(mwx)}, ${Math.round(mwy)}]`, canvas.width - 10, canvas.height - 10);
  ctx.restore();
}

function drawCornerBadge(x, y, text, bg, fg) {
  ctx.save();
  ctx.font = "bold 13px 'Fredoka One', sans-serif";
  const w = ctx.measureText(text).width + 20;
  ctx.fillStyle = bg;
  ctx.globalAlpha = 0.88;
  roundRect(ctx, x - w / 2, y - 14, w, 28, 8);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = fg;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// ============================================================
//  INPUT
// ============================================================

function setupInput() {
  window.addEventListener('resize', () => { resizeCanvas(); });

  // Zoom on wheel
  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 0.91;
    const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, viewport.zoom * factor));
    const wx = (e.clientX - viewport.x) / viewport.zoom;
    const wy = (e.clientY - viewport.y) / viewport.zoom;
    viewport.zoom = newZoom;
    viewport.x = e.clientX - wx * newZoom;
    viewport.y = e.clientY - wy * newZoom;
    scheduleSave();
  }, { passive: false });

  canvas.addEventListener('mousedown', e => {
    mouse.down = true;
    mouse.lastX = e.clientX;
    mouse.lastY = e.clientY;

    if (editor.active) {
      editorHandleClick(e);
    }
  });

  canvas.addEventListener('mousemove', e => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;

    if (mouse.down && !editor.active) {
      viewport.x += e.clientX - mouse.lastX;
      viewport.y += e.clientY - mouse.lastY;
      scheduleSave();
    }

    if (editor.active) editorHandleMove(e);

    mouse.lastX = e.clientX;
    mouse.lastY = e.clientY;
  });

  canvas.addEventListener('mouseup', e => {
    mouse.down = false;
    if (editor.active && editor.dragPointIdx !== -1) {
      editor.dragPointIdx = -1;
    }
  });

  canvas.addEventListener('contextmenu', e => {
    e.preventDefault();
    if (editor.active && editor.newPoints.length > 0) {
      // Remove last point on right-click
      editor.newPoints.pop();
    }
  });

  // Touch support (basic pan/pinch-zoom)
  let lastTouchDist = null;
  canvas.addEventListener('touchstart', e => {
    e.preventDefault();
    if (e.touches.length === 1) {
      mouse.down = true;
      mouse.lastX = e.touches[0].clientX;
      mouse.lastY = e.touches[0].clientY;
    }
    if (e.touches.length === 2) {
      lastTouchDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
    }
  }, { passive: false });

  canvas.addEventListener('touchmove', e => {
    e.preventDefault();
    if (e.touches.length === 1 && mouse.down) {
      const dx = e.touches[0].clientX - mouse.lastX;
      const dy = e.touches[0].clientY - mouse.lastY;
      viewport.x += dx;
      viewport.y += dy;
      mouse.lastX = e.touches[0].clientX;
      mouse.lastY = e.touches[0].clientY;
    }
    if (e.touches.length === 2 && lastTouchDist !== null) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const factor = dist / lastTouchDist;
      const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, viewport.zoom * factor));
      const wx = (cx - viewport.x) / viewport.zoom;
      const wy = (cy - viewport.y) / viewport.zoom;
      viewport.zoom = newZoom;
      viewport.x = cx - wx * newZoom;
      viewport.y = cy - wy * newZoom;
      lastTouchDist = dist;
      scheduleSave();
    }
  }, { passive: false });

  canvas.addEventListener('touchend', () => {
    mouse.down = false;
    lastTouchDist = null;
  });

  // Keyboard shortcuts
  window.addEventListener('keydown', e => {
    if (e.key === 'e' || e.key === 'E') toggleEditorPanel();
    if (e.key === 'Escape') {
      if (editor.active) editor.newPoints = [];
    }
    if (e.key === 'Enter' && editor.active && editor.newPoints.length >= 3) {
      saveEditorZone();
    }
    if (e.key === 'f' || e.key === 'F') fitImageToWindow();
  });
}

// ============================================================
//  ZONE EDITOR
// ============================================================

function editorHandleClick(e) {
  const [wx, wy] = canvasToWorld(e.clientX, e.clientY);

  // Check if clicking near an existing handle (drag mode)
  const hitIdx = editor.newPoints.findIndex(p => {
    const [hx, hy] = worldToCanvas(p[0], p[1]);
    return Math.hypot(hx - e.clientX, hy - e.clientY) < 10;
  });

  if (hitIdx !== -1) {
    editor.dragPointIdx = hitIdx;
  } else {
    editor.newPoints.push([Math.round(wx), Math.round(wy)]);
  }
}

function editorHandleMove(e) {
  const [wx, wy] = canvasToWorld(e.clientX, e.clientY);

  // Update hover
  editor.hoveredPointIdx = editor.newPoints.findIndex(p => {
    const [hx, hy] = worldToCanvas(p[0], p[1]);
    return Math.hypot(hx - e.clientX, hy - e.clientY) < 10;
  });

  // Drag point
  if (mouse.down && editor.dragPointIdx !== -1) {
    editor.newPoints[editor.dragPointIdx] = [Math.round(wx), Math.round(wy)];
  }
}

function saveEditorZone() {
  const zoneId = document.getElementById('editorZoneSelect').value;
  const pts = editor.newPoints.map(p => [Math.round(p[0]), Math.round(p[1])]);

  if (zoneId === 'property') {
    zones.property.points = pts;
  } else {
    const garden = zones.gardens.find(g => g.id === zoneId);
    if (garden) {
      garden.points = pts;
    } else {
      // New garden
      zones.gardens.push({
        id: zoneId,
        label: zoneId,
        strokeColor: '#44dd44',
        fillColor: 'rgba(68,221,68,0.15)',
        lineWidth: 2.5,
        points: pts
      });
    }
  }

  saveZones(zones);
  invalidateTerrainCache();
  showToast(`Zone "${zoneId}" saved! (${pts.length} points)`);
  editor.newPoints = [];
}

function loadZoneIntoEditor(zoneId) {
  editor.targetZoneId = zoneId;
  if (zoneId === 'property') {
    editor.newPoints = zones.property.points.map(p => [...p]);
  } else {
    const garden = zones.gardens.find(g => g.id === zoneId);
    editor.newPoints = garden ? garden.points.map(p => [...p]) : [];
  }
}

function resetZonesToDefault() {
  if (!confirm('Reset all zones to defaults? This will clear your calibrated positions.')) return;
  localStorage.removeItem('yardsim_zones');
  zones = loadZones();
  editor.newPoints = [];
  showToast('Zones reset to defaults');
}

// ============================================================
//  UI SETUP
// ============================================================

function setupUI() {
  // Layer toggles
  ['sunZones', 'grid', 'gardenOutlines', 'propertyOutline'].forEach(key => {
    const btn = document.getElementById('toggle_' + key);
    if (!btn) return;
    btn.classList.toggle('active', layers[key]);
    btn.addEventListener('click', () => {
      layers[key] = !layers[key];
      btn.classList.toggle('active', layers[key]);
    });
  });

  // Zone editor panel
  document.getElementById('btnOpenEditor').addEventListener('click', toggleEditorPanel);
  document.getElementById('btnSaveZone').addEventListener('click', () => {
    if (editor.newPoints.length >= 3) saveEditorZone();
    else showToast('Need at least 3 points to save a zone');
  });
  document.getElementById('btnClearZone').addEventListener('click', () => {
    editor.newPoints = [];
  });
  document.getElementById('btnResetZones').addEventListener('click', resetZonesToDefault);
  document.getElementById('btnLoadZone').addEventListener('click', () => {
    loadZoneIntoEditor(document.getElementById('editorZoneSelect').value);
  });
  document.getElementById('btnCopyJSON').addEventListener('click', () => {
    const out = { property: zones.property.points, gardens: zones.gardens.map(g => ({ id: g.id, points: g.points })) };
    navigator.clipboard.writeText(JSON.stringify(out, null, 2));
    showToast('Zone JSON copied to clipboard');
  });
  document.getElementById('btnFitView').addEventListener('click', fitImageToWindow);
}

function toggleEditorPanel() {
  editor.active = !editor.active;
  document.getElementById('editorPanel').classList.toggle('open', editor.active);
  document.getElementById('btnOpenEditor').classList.toggle('active', editor.active);
  if (!editor.active) editor.newPoints = [];
}

// ============================================================
//  TOAST NOTIFICATIONS
// ============================================================

function showToast(msg) {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('show'), 2800);
}

// ============================================================
//  BOOT
// ============================================================
window.addEventListener('load', init);
