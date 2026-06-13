// ============================================================
//  YardSim — Phase 1: Map, Zones, Grid, Chickens
// ============================================================

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// ---- State ----
let zones      = loadZones();
let structures = loadStructures();
let chickens   = [];
let lastTimestamp = 0;

const viewport = { x: 0, y: 0, zoom: 1 };
const MIN_ZOOM = 0.35;
const MAX_ZOOM = 6;

// Placed items
let placedItems = [];

// ---- Paint tool ----
const paint = { brushType: null, lastCell: null };

// ---- Placement tool ----
const placement = {
  active:    false,
  catalogId: null,
  rowStart:  null   // {x,y} in world-px when dragging a plant row; null otherwise
};
let selectedItemId = null;

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
    if (Array.isArray(state.placedItems)) placedItems = state.placedItems;
    if (state.customTiles) loadCustomTiles(state.customTiles);
  } catch (e) {
    console.warn('Could not restore game state:', e);
  }
}

function saveGameState() {
  const state = {
    version: STATE_VERSION,
    viewport: { x: viewport.x, y: viewport.y, zoom: viewport.zoom },
    placedItems,
    customTiles: getCustomTiles(),
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

// Scale: driveway = 40px wide, real-world ≈ 8ft → 5 px/ft
// Property 880px N–S ÷ 5 = 176ft ≈ 60 yards ✓
const PX_PER_FOOT    = 5;
const SNAP_PX        = TILE_SIZE;      // 5px = 1ft — zone editor / structure snap
const PLANT_SNAP     = TILE_SIZE * 0.5; // 2.5px = 0.5ft — plant placement snap
const GRID_PX_FINE   = TILE_SIZE;      // 5px = 1ft — fine grid (gardens)
const GRID_PX_COARSE = 25;             // 25px = 5ft — coarse grid (yard)

// ---- Zone Editor State ----
const editor = {
  active: false,
  targetZoneId: null,
  newPoints: [],
  dragPointIdx: -1,
  hoveredPointIdx: -1,
  hoveredEdgeIdx: -1,       // polygon segment index where cursor is close to
  hoveredEdgePoint: null,   // snapped insertion point on that edge [wx, wy]
  history: []               // undo stack — each entry is a snapshot of newPoints
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
  buildPalette();
  requestAnimationFrame(gameLoop);
}

// World space is 954×972 (matches original satellite image dimensions)
const WORLD_W = 954;
const WORLD_H = 972;

const PALETTE_W = 200; // must match #palette width in CSS

function fitImageToWindow() {
  const scaleX = (window.innerWidth  - PALETTE_W - 20) / WORLD_W;
  const scaleY = (window.innerHeight - 72)              / WORLD_H;
  viewport.zoom = Math.min(scaleX, scaleY, 1);
  viewport.x = PALETTE_W + 10;
  viewport.y = 62;
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

  if (layers.sunZones)       drawSunZones();
  if (layers.grid)           drawGrid();

  drawStructures(ctx, structures, viewport.zoom);
  drawPaintCursor(ctx);

  if (layers.gardenOutlines) drawGardenBeds();
  if (layers.propertyOutline) drawPropertyOutline();

  chickens.forEach(c => c.draw(ctx));

  drawPlacedItems(ctx);
  if (placement.active) drawPlacementGhost(ctx);

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
//  PAINT CURSOR
// ============================================================

function drawPaintCursor(ctx) {
  if (paint.brushType === null) return;
  const [wx, wy] = canvasToWorld(mouse.x, mouse.y);
  const tx = Math.floor(wx / TILE_SIZE);
  const ty = Math.floor(wy / TILE_SIZE);
  const px = tx * TILE_SIZE;
  const py = ty * TILE_SIZE;
  const s  = TILE_SIZE;
  ctx.save();
  ctx.fillStyle   = paint.brushType === TILE_GRASS
    ? 'rgba(100, 210, 70, 0.38)'
    : 'rgba(180, 110, 50, 0.40)';
  ctx.fillRect(px, py, s, s);
  ctx.strokeStyle = paint.brushType === TILE_GRASS ? '#66ff33' : '#ffaa33';
  ctx.lineWidth   = 0.8 / viewport.zoom;
  ctx.strokeRect(px, py, s, s);
  ctx.restore();
}

// ============================================================
//  PAINT TOOL
// ============================================================

function tryPaint(canvasX, canvasY) {
  if (paint.brushType === null) return;
  const [wx, wy] = canvasToWorld(canvasX, canvasY);
  const tx  = Math.floor(wx / TILE_SIZE);
  const ty  = Math.floor(wy / TILE_SIZE);
  const key = `${tx},${ty}`;
  if (key === paint.lastCell) return;
  paint.lastCell = key;
  // Only paint inside the property boundary
  if (!pointInPolygon((tx + 0.5) * TILE_SIZE, (ty + 0.5) * TILE_SIZE, zones.property.points)) return;
  setCustomTile(tx, ty, paint.brushType);
  scheduleSave();
}

function setPaintBrush(type) {
  paint.brushType = paint.brushType === type ? null : type;
  document.getElementById('btnPaintGrass').classList.toggle('active', paint.brushType === TILE_GRASS);
  document.getElementById('btnPaintSoil').classList.toggle('active',  paint.brushType === TILE_SOIL);
  canvas.style.cursor = paint.brushType !== null ? 'crosshair' : 'grab';
}

// ============================================================
//  EXPORT
// ============================================================

function exportMapAsJSON() {
  const data = {
    version: 1,
    exportedAt: new Date().toISOString(),
    scale: { pxPerFoot: PX_PER_FOOT, tileSizePx: TILE_SIZE, tileSizeFt: 1 },
    zones: {
      property: { points: zones.property.points },
      gardens:  zones.gardens.map(g => ({ id: g.id, label: g.label, points: g.points }))
    },
    structures: structures.map(s => ({ id: s.id, label: s.label, type: s.type, points: s.points })),
    customTiles: getCustomTiles(),
    placedItems
  };
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = 'yardsim-map.json';
  a.click();
  URL.revokeObjectURL(url);
  showToast('Exported as yardsim-map.json');
}

// ============================================================
//  PLACED ITEMS — RENDERING
// ============================================================

function drawPlacedItems(ctx) {
  placedItems.forEach(item => {
    const cat = getCatalogEntry(item.catalogId);
    if (!cat) return;
    const isSelected = item.id === selectedItemId;

    ctx.save();
    ctx.translate(item.x, item.y);

    if (isPlant(cat)) {
      _drawPlant(ctx, cat, isSelected, item);
    } else {
      _drawStructureItem(ctx, cat, isSelected, item);
    }

    ctx.restore();
  });
}

// Spacing ring radius — half the recommended center-to-center distance.
// Minimum 8px (1.6ft) so the sprite is always readable.
function _spacingRingR(cat) {
  return Math.max(PX_PER_FOOT * 1.6, cat.spacingFt * PX_PER_FOOT * 0.5);
}

function _drawPlant(ctx, cat, isSelected, item) {
  const r = _spacingRingR(cat);

  // Dashed spacing ring (thin, behind the sprite)
  ctx.strokeStyle = isSelected ? 'rgba(255,220,80,0.55)' : 'rgba(180,230,130,0.28)';
  ctx.lineWidth   = (isSelected ? 1.5 : 0.8) / viewport.zoom;
  ctx.setLineDash([3 / viewport.zoom, 3 / viewport.zoom]);
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // Opaque sprite centered in the spacing circle
  drawPlantSprite(ctx, cat, r, isSelected);
}

function _drawStructureItem(ctx, cat, isSelected, item) {
  const w = cat.widthFt  * PX_PER_FOOT;
  const h = cat.heightFt * PX_PER_FOOT;

  // Opaque fill — structures should be solid on the map
  ctx.fillStyle = isSelected ? '#c8a870' : '#b89060';
  ctx.fillRect(0, 0, w, h);

  // Subtle inner shading for depth
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  ctx.fillRect(0, h * 0.55, w, h * 0.45);
  ctx.fillStyle = 'rgba(255,255,255,0.10)';
  ctx.fillRect(0, 0, w, h * 0.35);

  // Border
  ctx.strokeStyle = isSelected ? '#ffdc50' : '#7a5520';
  ctx.lineWidth   = (isSelected ? 2 : 1.5) / viewport.zoom;
  ctx.strokeRect(0, 0, w, h);

  // Emoji centered
  const emsz = Math.max(6, Math.min(w, h) * 0.58);
  ctx.font         = `${emsz}px serif`;
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(cat.emoji, w / 2, h / 2);
}

// Returns evenly-spaced plant positions along a drag line
function getRowPositions(start, end, cat) {
  const spacing = cat.spacingFt * PX_PER_FOOT;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const dist = Math.hypot(dx, dy);
  if (dist < spacing * 0.35) return [start]; // treat as single click
  const nx = dx / dist;
  const ny = dy / dist;
  const count = Math.floor(dist / spacing) + 1;
  const positions = [];
  for (let i = 0; i < count; i++) {
    const [sx, sy] = _snapPlant(start.x + nx * spacing * i, start.y + ny * spacing * i);
    positions.push({ x: sx, y: sy });
  }
  return positions;
}

function _drawGhostPlantAt(ctx, cat, sx, sy) {
  const r = _spacingRingR(cat);
  const overlap = placedItems.some(it => {
    const oc = getCatalogEntry(it.catalogId);
    if (!oc || !isPlant(oc)) return false;
    return Math.hypot(it.x - sx, it.y - sy) < cat.spacingFt * PX_PER_FOOT;
  });

  ctx.save();
  ctx.translate(sx, sy);

  // Opaque sprite (same as placed, slightly dimmed)
  ctx.globalAlpha = 0.82;
  drawPlantSprite(ctx, cat, r, false);
  ctx.globalAlpha = 1;

  // Placement ring — green (clear) or red (overlap)
  ctx.strokeStyle = overlap ? 'rgba(255,60,60,0.9)' : 'rgba(80,220,80,0.8)';
  ctx.lineWidth   = 1.5 / viewport.zoom;
  ctx.setLineDash([4 / viewport.zoom, 3 / viewport.zoom]);
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.restore();
}

function drawPlacementGhost(ctx) {
  const cat = getCatalogEntry(placement.catalogId);
  if (!cat) return;

  const [wx, wy] = canvasToWorld(mouse.x, mouse.y);

  // ── Row drag preview (plants only) ──
  if (isPlant(cat) && placement.rowStart && mouse.down) {
    const [ex, ey] = _snapPlant(wx, wy);
    const end = { x: ex, y: ey };
    const positions = getRowPositions(placement.rowStart, end, cat);

    ctx.save();
    // Dashed guide line
    ctx.strokeStyle = 'rgba(255,220,80,0.35)';
    ctx.lineWidth   = 1 / viewport.zoom;
    ctx.setLineDash([4 / viewport.zoom, 4 / viewport.zoom]);
    ctx.beginPath();
    ctx.moveTo(placement.rowStart.x, placement.rowStart.y);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    ctx.setLineDash([]);

    // Ghost plants along the row
    ctx.globalAlpha = 0.6;
    positions.forEach(pos => _drawGhostPlantAt(ctx, cat, pos.x, pos.y));

    // Count badge near the end point
    if (positions.length > 1) {
      ctx.globalAlpha = 1;
      ctx.font         = `bold ${11 / viewport.zoom}px 'Fredoka One', sans-serif`;
      ctx.fillStyle    = '#ffdc50';
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'bottom';
      ctx.shadowColor  = 'rgba(0,0,0,0.9)';
      ctx.shadowBlur   = 3 / viewport.zoom;
      ctx.fillText(`${positions.length}×  ${cat.name}`, ex, ey - _spacingRingR(cat) - 3 / viewport.zoom);
      ctx.shadowBlur = 0;
    }
    ctx.restore();
    return;
  }

  // ── Single ghost ──
  ctx.save();
  ctx.globalAlpha = 0.6;
  if (isPlant(cat)) {
    const [sx, sy] = _snapPlant(wx, wy);
    _drawGhostPlantAt(ctx, cat, sx, sy);
  } else {
    // Structure ghost
    const [sx, sy] = _snapToGrid(wx, wy);
    const w = cat.widthFt  * PX_PER_FOOT;
    const h = cat.heightFt * PX_PER_FOOT;
    ctx.fillStyle   = 'rgba(184,144,96,0.5)';
    ctx.strokeStyle = 'rgba(200,160,80,0.9)';
    ctx.lineWidth   = 1.5 / viewport.zoom;
    ctx.fillRect(sx, sy, w, h);
    ctx.strokeRect(sx, sy, w, h);
    const emsz = Math.max(6, Math.min(w, h) * 0.55);
    ctx.font = `${emsz}px serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(cat.emoji, sx + w / 2, sy + h / 2);
  }
  ctx.restore();
}

// ============================================================
//  PLACEMENT LOGIC
// ============================================================

function startPlacement(catalogId) {
  // Cancel any existing placement
  placement.active    = true;
  placement.catalogId = catalogId;
  selectedItemId      = null;
  hideItemPopup();
  // Deactivate incompatible modes
  if (editor.active) toggleEditorPanel();
  setPaintBrush(null);
  canvas.style.cursor = 'crosshair';
  // Highlight active palette button
  document.querySelectorAll('.palette-item').forEach(el => {
    el.classList.toggle('active', el.dataset.id === catalogId);
  });
}

function cancelPlacement() {
  placement.active    = false;
  placement.catalogId = null;
  canvas.style.cursor = 'default';
  document.querySelectorAll('.palette-item').forEach(el => el.classList.remove('active'));
}

function tryPlaceItem(cx, cy) {
  // Used for structures (immediate single placement on click)
  const cat = getCatalogEntry(placement.catalogId);
  if (!cat) return;
  const [wx, wy] = canvasToWorld(cx, cy);
  const [sx, sy] = _snapToGrid(wx, wy);
  const checkX = sx + (cat.widthFt  * PX_PER_FOOT) / 2;
  const checkY = sy + (cat.heightFt * PX_PER_FOOT) / 2;
  if (!pointInPolygon(checkX, checkY, zones.property.points)) return;
  confirmPlacement(cat, sx, sy);
}

function finalizePlantRow(cx, cy) {
  const cat = getCatalogEntry(placement.catalogId);
  if (!cat || !isPlant(cat) || !placement.rowStart) return;

  const [wx, wy] = canvasToWorld(cx, cy);
  const [ex, ey] = _snapPlant(wx, wy);
  const positions = getRowPositions(placement.rowStart, { x: ex, y: ey }, cat);

  // Filter to positions inside property
  const valid = positions.filter(p =>
    pointInPolygon(p.x, p.y, zones.property.points)
  );
  if (valid.length === 0) { placement.rowStart = null; return; }

  if (cat.isTuber) {
    showTuberWarning(cat, () => valid.forEach(p => confirmPlacement(cat, p.x, p.y)));
  } else {
    valid.forEach(p => confirmPlacement(cat, p.x, p.y));
  }
  placement.rowStart = null;
}

function confirmPlacement(cat, sx, sy) {
  const item = {
    id:          crypto.randomUUID(),
    catalogId:   cat.id,
    x:           sx,
    y:           sy,
    rotation:    0,
    placedDate:  new Date().toISOString().slice(0, 10),
    notes:       ''
  };
  placedItems.push(item);
  scheduleSave();
}

// ============================================================
//  ITEM SELECTION
// ============================================================

function getItemAtPoint(wx, wy) {
  for (let i = placedItems.length - 1; i >= 0; i--) {
    const item = placedItems[i];
    const cat  = getCatalogEntry(item.catalogId);
    if (!cat) continue;
    if (isPlant(cat)) {
      const r = Math.max(4, cat.spacingFt * PX_PER_FOOT * 0.5);
      if (Math.hypot(wx - item.x, wy - item.y) < r) return item;
    } else {
      const w = cat.widthFt  * PX_PER_FOOT;
      const h = cat.heightFt * PX_PER_FOOT;
      if (wx >= item.x && wx <= item.x + w && wy >= item.y && wy <= item.y + h) return item;
    }
  }
  return null;
}

function selectItem(item) {
  selectedItemId = item.id;
  const cat = getCatalogEntry(item.catalogId);
  const [sx, sy] = worldToCanvas(item.x, item.y);
  showItemPopup(item, cat, sx, sy);
}

function deleteSelectedItem() {
  if (!selectedItemId) return;
  placedItems = placedItems.filter(it => it.id !== selectedItemId);
  selectedItemId = null;
  hideItemPopup();
  scheduleSave();
}

// ============================================================
//  TUBER WARNING MODAL
// ============================================================

function showTuberWarning(cat, onConfirm) {
  document.getElementById('tuberModalName').textContent = cat.name;
  document.getElementById('tuberModal').classList.remove('hidden');
  const confirmBtn = document.getElementById('tuberModalConfirm');
  const cancelBtn  = document.getElementById('tuberModalCancel');
  const close = () => document.getElementById('tuberModal').classList.add('hidden');
  confirmBtn.onclick = () => { close(); onConfirm(); };
  cancelBtn.onclick  = () => { close(); };
}

// ============================================================
//  ITEM INFO POPUP
// ============================================================

function showItemPopup(item, cat, sx, sy) {
  const popup = document.getElementById('itemPopup');

  document.getElementById('popupEmoji').textContent = cat.emoji;
  document.getElementById('popupName').textContent  = cat.name;

  let details = '';
  if (isPlant(cat)) {
    details += `<div class="popup-row">${SUN_LABEL[cat.sunNeeds] || cat.sunNeeds}</div>`;
    details += `<div class="popup-row">📏 ${cat.spacingFt}ft spacing</div>`;
    if (cat.plantStart) {
      details += `<div class="popup-row">📅 Plant: ${cat.plantStart}${cat.plantEnd ? ' – ' + cat.plantEnd : ''} (SW Ohio)</div>`;
      const status = plantingStatus(cat);
      if (status) details += `<div class="popup-status ${inPlantingWindow(cat) ? 'good' : ''}">${status}</div>`;
    }
    if (cat.daysToHarvest) {
      const hr = estimatedHarvest(cat, item.placedDate);
      details += `<div class="popup-row">🌱 ${cat.daysToHarvest[0]}–${cat.daysToHarvest[1]} days to harvest</div>`;
      if (hr) details += `<div class="popup-row">🗓 Est. harvest: ${hr}</div>`;
    }
    if (cat.isTuber) details += `<div class="popup-warn">⚠️ Root crop — soil quality advisory</div>`;
    if (cat.notes) details += `<div class="popup-note">${cat.notes}</div>`;
  } else {
    details += `<div class="popup-row">📐 ${cat.widthFt}ft × ${cat.heightFt}ft</div>`;
    if (cat.notes) details += `<div class="popup-note">${cat.notes}</div>`;
  }
  document.getElementById('popupDetails').innerHTML = details;

  // Position near item, clamped to viewport
  const pw = 240, ph = 220;
  const left = Math.min(sx + 24, window.innerWidth  - pw - 12);
  const top  = Math.max(60,      Math.min(sy - 60,  window.innerHeight - ph - 12));
  popup.style.left = `${left}px`;
  popup.style.top  = `${top}px`;
  popup.classList.remove('hidden');
}

function hideItemPopup() {
  document.getElementById('itemPopup').classList.add('hidden');
  selectedItemId = null;
}

// ============================================================
//  PALETTE
// ============================================================

function buildPalette() {
  const container = document.getElementById('paletteItems');
  container.innerHTML = '';

  // ── Plants tab ──
  const plantDiv = document.createElement('div');
  plantDiv.id = 'tabContentPlants';

  const grouped = {};
  CATALOG.plants.forEach(p => {
    (grouped[p.category] = grouped[p.category] || []).push(p);
  });

  CAT_ORDER_PLANTS.forEach(cat => {
    if (!grouped[cat]) return;
    const header = document.createElement('div');
    header.className = 'palette-group-label';
    header.textContent = cat.charAt(0).toUpperCase() + cat.slice(1) + 's';
    plantDiv.appendChild(header);
    grouped[cat].forEach(p => plantDiv.appendChild(_makePaletteBtn(p)));
  });

  // ── Structures tab ──
  const structDiv = document.createElement('div');
  structDiv.id = 'tabContentStructures';
  structDiv.classList.add('hidden');
  CATALOG.structures.forEach(s => structDiv.appendChild(_makePaletteBtn(s)));

  container.appendChild(plantDiv);
  container.appendChild(structDiv);

  // Tab switching
  document.getElementById('tabPlants').addEventListener('click', () => {
    plantDiv.classList.remove('hidden');
    structDiv.classList.add('hidden');
    document.getElementById('tabPlants').classList.add('active');
    document.getElementById('tabStructures').classList.remove('active');
  });
  document.getElementById('tabStructures').addEventListener('click', () => {
    structDiv.classList.remove('hidden');
    plantDiv.classList.add('hidden');
    document.getElementById('tabStructures').classList.add('active');
    document.getElementById('tabPlants').classList.remove('active');
  });

  // Search filter
  document.getElementById('paletteSearch').addEventListener('input', e => {
    const q = e.target.value.toLowerCase();
    document.querySelectorAll('.palette-item').forEach(btn => {
      btn.style.display = btn.dataset.name.includes(q) ? '' : 'none';
    });
  });
}

function _makePaletteBtn(entry) {
  const btn = document.createElement('button');
  btn.className  = 'palette-item';
  btn.dataset.id = entry.id;
  btn.dataset.name = entry.name.toLowerCase();
  btn.innerHTML  = `<span class="pi-emoji">${entry.emoji}</span><span class="pi-name">${entry.name}</span>`;
  if (entry.isTuber) btn.innerHTML += `<span class="pi-warn" title="Root crop — soil advisory">⚠️</span>`;
  btn.addEventListener('click', () => {
    if (placement.active && placement.catalogId === entry.id) {
      cancelPlacement();
    } else {
      startPlacement(entry.id);
    }
  });
  return btn;
}

// ============================================================
//  ZONE EDITOR OVERLAY
// ============================================================

function drawEditorOverlay() {
  const pts = editor.newPoints;
  if (!pts.length) return;

  ctx.save();

  // ── Polygon outline ──
  ctx.strokeStyle = '#ffdd00';
  ctx.lineWidth   = 2 / viewport.zoom;
  ctx.setLineDash([6 / viewport.zoom, 3 / viewport.zoom]);
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (const p of pts) ctx.lineTo(p[0], p[1]);
  if (pts.length > 2) {
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.lineTo(pts[0][0], pts[0][1]);
    ctx.restore();
  }
  ctx.stroke();
  ctx.setLineDash([]);

  // ── Edge insertion indicator ──
  if (editor.hoveredEdgeIdx !== -1 && editor.hoveredEdgePoint) {
    const [ex, ey] = editor.hoveredEdgePoint;
    const r = 5 / viewport.zoom;
    ctx.fillStyle   = '#44ff88';
    ctx.strokeStyle = '#006633';
    ctx.lineWidth   = 1.2 / viewport.zoom;
    ctx.beginPath();
    ctx.arc(ex, ey, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Draw "+" symbol
    ctx.strokeStyle = '#fff';
    ctx.lineWidth   = 1.5 / viewport.zoom;
    ctx.lineCap     = 'round';
    ctx.beginPath();
    ctx.moveTo(ex - r * 0.55, ey); ctx.lineTo(ex + r * 0.55, ey); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(ex, ey - r * 0.55); ctx.lineTo(ex, ey + r * 0.55); ctx.stroke();
  }

  // ── Vertex handles ──
  pts.forEach((p, i) => {
    const isHovered  = i === editor.hoveredPointIdx;
    const isDragging = i === editor.dragPointIdx;
    const r = (isDragging ? 8 : isHovered ? 7 : 5.5) / viewport.zoom;

    ctx.beginPath();
    ctx.arc(p[0], p[1], r, 0, Math.PI * 2);
    ctx.fillStyle = isDragging ? '#ff8800' : isHovered ? '#ffdd00' : '#ffffff';
    ctx.fill();
    ctx.strokeStyle = isHovered ? '#cc6600' : '#ff8800';
    ctx.lineWidth   = 1.5 / viewport.zoom;
    ctx.stroke();

    // Right-click hint on hover
    if (isHovered) {
      ctx.font        = `bold ${8 / viewport.zoom}px monospace`;
      ctx.fillStyle   = '#ff4444';
      ctx.textAlign   = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText('✕', p[0], p[1] - r - 1 / viewport.zoom);
    }

    // Index label inside the handle
    ctx.font         = `${7.5 / viewport.zoom}px monospace`;
    ctx.fillStyle    = '#222';
    ctx.textAlign    = 'center';
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
    mouse.down  = true;
    mouse.lastX = e.clientX;
    mouse.lastY = e.clientY;
    paint.lastCell = null;

    if (editor.active) {
      editorHandleClick(e);
    } else if (placement.active) {
      const cat = getCatalogEntry(placement.catalogId);
      if (cat && isPlant(cat)) {
        // Plants: start row tracking — finalize on mouseup
        const [wx, wy] = canvasToWorld(e.clientX, e.clientY);
        const [sx, sy] = _snapPlant(wx, wy);
        placement.rowStart = { x: sx, y: sy };
      } else {
        // Structures: place immediately
        tryPlaceItem(e.clientX, e.clientY);
      }
    } else if (paint.brushType !== null) {
      tryPaint(e.clientX, e.clientY);
    } else {
      // Try to select a placed item
      const [wx, wy] = canvasToWorld(e.clientX, e.clientY);
      const hit = getItemAtPoint(wx, wy);
      if (hit) {
        selectItem(hit);
      } else {
        selectedItemId = null;
        hideItemPopup();
      }
    }
  });

  canvas.addEventListener('mousemove', e => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;

    if (mouse.down) {
      if (editor.active) {
        editorHandleMove(e);
      } else if (paint.brushType !== null) {
        tryPaint(e.clientX, e.clientY);
      } else {
        // Pan
        viewport.x += e.clientX - mouse.lastX;
        viewport.y += e.clientY - mouse.lastY;
        scheduleSave();
      }
    }

    mouse.lastX = e.clientX;
    mouse.lastY = e.clientY;
  });

  canvas.addEventListener('mouseup', e => {
    mouse.down = false;
    paint.lastCell = null;
    if (editor.active && editor.dragPointIdx !== -1) {
      editor.dragPointIdx = -1;
    }
    // Finalize plant row on mouseup
    if (placement.active && placement.rowStart) {
      finalizePlantRow(e.clientX, e.clientY);
    }
  });

  canvas.addEventListener('contextmenu', e => {
    e.preventDefault();
    if (!editor.active || editor.newPoints.length === 0) return;
    editorPushHistory();
    if (editor.hoveredPointIdx !== -1) {
      // Right-click on a handle → remove that specific point
      editor.newPoints.splice(editor.hoveredPointIdx, 1);
      editor.hoveredPointIdx = -1;
    } else {
      // Right-click elsewhere → remove last point
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
    if (e.key === 'e' || e.key === 'E') { toggleEditorPanel(); return; }
    if (e.key === 'f' || e.key === 'F') { fitImageToWindow(); return; }
    if (e.key === 'Escape') {
      if (placement.rowStart) { placement.rowStart = null; return; }
      if (placement.active)   { cancelPlacement(); return; }
      if (editor.active)     { editor.newPoints = []; return; }
      if (selectedItemId)    { hideItemPopup(); return; }
    }
    if (e.key === 'Enter' && editor.active && editor.newPoints.length >= 3) {
      saveEditorZone(); return;
    }
    if ((e.key === 'Delete' || e.key === 'Backspace') && selectedItemId) {
      e.preventDefault();
      deleteSelectedItem();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && editor.active) {
      e.preventDefault();
      editorUndo();
    }
  });
}

// ============================================================
//  ZONE EDITOR
// ============================================================

function _snapToGrid(wx, wy) {
  return [Math.round(wx / SNAP_PX) * SNAP_PX, Math.round(wy / SNAP_PX) * SNAP_PX];
}

// Plants snap to the CENTER of 0.5ft cells so they sit inside tiles, not on corners
function _snapPlant(wx, wy) {
  const s = PLANT_SNAP;
  return [Math.floor(wx / s) * s + s * 0.5, Math.floor(wy / s) * s + s * 0.5];
}

// Returns closest point on segment AB to P, plus distance and interpolation t
function _closestOnSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return { dist: Math.hypot(px - ax, py - ay), t: 0, nx: ax, ny: ay };
  const t  = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  const nx = ax + t * dx;
  const ny = ay + t * dy;
  return { dist: Math.hypot(px - nx, py - ny), t, nx, ny };
}

// ---- Undo ----

function editorPushHistory() {
  editor.history.push(editor.newPoints.map(p => [...p]));
  if (editor.history.length > 60) editor.history.shift();
}

function editorUndo() {
  if (editor.history.length === 0) { showToast('Nothing to undo'); return; }
  editor.newPoints      = editor.history.pop();
  editor.dragPointIdx   = -1;
  editor.hoveredPointIdx = -1;
  editor.hoveredEdgeIdx  = -1;
  editor.hoveredEdgePoint = null;
  showToast(`Undo — ${editor.newPoints.length} points`);
}

// ---- Click / Move ----

function editorHandleClick(e) {
  // 1. Handle hit → start drag
  const hitIdx = editor.newPoints.findIndex(p => {
    const [hx, hy] = worldToCanvas(p[0], p[1]);
    return Math.hypot(hx - e.clientX, hy - e.clientY) < 10;
  });
  if (hitIdx !== -1) {
    editorPushHistory();            // save state before drag begins
    editor.dragPointIdx = hitIdx;
    return;
  }

  // 2. Edge hover → insert new point on that edge
  if (editor.hoveredEdgeIdx !== -1 && editor.hoveredEdgePoint) {
    editorPushHistory();
    const snapped = _snapToGrid(...editor.hoveredEdgePoint);
    editor.newPoints.splice(editor.hoveredEdgeIdx + 1, 0, snapped);
    editor.hoveredEdgeIdx   = -1;
    editor.hoveredEdgePoint = null;
    return;
  }

  // 3. Fallback → append new point to end
  editorPushHistory();
  const raw = canvasToWorld(e.clientX, e.clientY);
  editor.newPoints.push(_snapToGrid(...raw));
}

function editorHandleMove(e) {
  const [wx, wy] = canvasToWorld(e.clientX, e.clientY);

  // Update handle hover
  editor.hoveredPointIdx = editor.newPoints.findIndex(p => {
    const [hx, hy] = worldToCanvas(p[0], p[1]);
    return Math.hypot(hx - e.clientX, hy - e.clientY) < 10;
  });

  // Drag active point
  if (mouse.down && editor.dragPointIdx !== -1) {
    editor.newPoints[editor.dragPointIdx] = _snapToGrid(wx, wy);
    return; // skip edge detection while dragging
  }

  // Detect edge hover for insertion (only when not hovering a handle)
  editor.hoveredEdgeIdx   = -1;
  editor.hoveredEdgePoint = null;
  const pts = editor.newPoints;
  if (editor.hoveredPointIdx === -1 && pts.length >= 2) {
    const THRESH = 8 / viewport.zoom; // 8 screen px → world px
    for (let i = 0; i < pts.length; i++) {
      const j   = (i + 1) % pts.length;
      const res = _closestOnSegment(wx, wy, pts[i][0], pts[i][1], pts[j][0], pts[j][1]);
      // Only fire on the interior of the edge (not right on a vertex)
      if (res.dist < THRESH && res.t > 0.08 && res.t < 0.92) {
        editor.hoveredEdgeIdx   = i;
        editor.hoveredEdgePoint = [res.nx, res.ny];
        break;
      }
    }
  }
}

function saveEditorZone() {
  const zoneId = document.getElementById('editorZoneSelect').value;
  // Ensure all points are on the 2ft grid
  const pts = editor.newPoints.map(p => _snapToGrid(p[0], p[1]));

  if (zoneId === 'property') {
    zones.property.points = pts;
    saveZones(zones);
  } else if (zones.gardens.some(g => g.id === zoneId) || zoneId.startsWith('garden_')) {
    const garden = zones.gardens.find(g => g.id === zoneId);
    if (garden) {
      garden.points = pts;
    } else {
      zones.gardens.push({ id: zoneId, label: zoneId,
        strokeColor: '#44dd44', fillColor: 'rgba(68,221,68,0.15)', lineWidth: 2.5, points: pts });
    }
    saveZones(zones);
  } else {
    // Try structures
    const struct = structures.find(s => s.id === zoneId);
    if (struct) {
      struct.points = pts;
      saveStructures(structures);
    }
  }

  invalidateTerrainCache();
  showToast(`"${zoneId}" saved! (${pts.length} points, snapped to 2ft grid)`);
  editor.newPoints = [];
}

function loadZoneIntoEditor(zoneId) {
  editor.targetZoneId = zoneId;
  if (zoneId === 'property') {
    editor.newPoints = zones.property.points.map(p => [...p]);
  } else {
    const garden = zones.gardens.find(g => g.id === zoneId);
    if (garden) {
      editor.newPoints = garden.points.map(p => [...p]);
      return;
    }
    const struct = structures.find(s => s.id === zoneId);
    editor.newPoints = struct ? struct.points.map(p => [...p]) : [];
  }
}

function resetZonesToDefault() {
  if (!confirm('Reset all zones to defaults? This will clear your calibrated positions.')) return;
  localStorage.removeItem('yardsim_zones');
  localStorage.removeItem('yardsim_structures');
  zones      = loadZones();
  structures = loadStructures();
  invalidateTerrainCache();
  editor.newPoints = [];
  showToast('Zones and structures reset to defaults');
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
    editorPushHistory();
    editor.newPoints = [];
  });
  document.getElementById('btnUndo').addEventListener('click', editorUndo);
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
  document.getElementById('btnPaintGrass').addEventListener('click', () => setPaintBrush(TILE_GRASS));
  document.getElementById('btnPaintSoil').addEventListener('click',  () => setPaintBrush(TILE_SOIL));
  document.getElementById('btnExportMap').addEventListener('click', exportMapAsJSON);
  document.getElementById('popupDelete').addEventListener('click', deleteSelectedItem);
  document.getElementById('popupClose').addEventListener('click',  hideItemPopup);
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
