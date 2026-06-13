// Procedural cartoon terrain renderer.
// Tiles are aligned to the coarse grid (TILE_SIZE × TILE_SIZE world pixels).
// All drawing is in world space — the viewport transform is already applied by the caller.

const TILE_SIZE = 20; // world px per tile = 8ft @ 2.5px/ft; matches GRID_PX_COARSE

const TILE_EXTERIOR = 0;
const TILE_GRASS    = 1;
const TILE_SOIL     = 2;

// Color palettes — multiple variants per type for visual variation
const GRASS_COLORS = ['#527e3c', '#5a8842', '#628e4a', '#4e7836', '#6a9652', '#578542'];
const SOIL_COLORS  = ['#8b5e3c', '#7a5030', '#986848', '#6e4828', '#8a5a36'];
const EXT_COLORS   = ['#2e4824', '#253c1c', '#334f28', '#2a421f', '#2d4720'];

// Tile type cache — zone membership is expensive; invalidate when zones change
let _typeCache  = new Map();
let _cacheTag   = '';

function _zoneTag(zones) {
  return zones.property.points.flat().join(',') + '|' + zones.gardens.length;
}

function invalidateTerrainCache() {
  _typeCache.clear();
  _cacheTag = '';
}

function _getType(tx, ty, zones) {
  const tag = _zoneTag(zones);
  if (tag !== _cacheTag) { _typeCache.clear(); _cacheTag = tag; }

  const key = (tx << 16) ^ ty; // fast integer key
  if (_typeCache.has(key)) return _typeCache.get(key);

  // Check the center of the tile
  const cx = (tx + 0.5) * TILE_SIZE;
  const cy = (ty + 0.5) * TILE_SIZE;
  let type = TILE_EXTERIOR;
  if (pointInPolygon(cx, cy, zones.property.points)) {
    type = TILE_GRASS;
    if (zones.gardens.some(g => pointInPolygon(cx, cy, g.points))) type = TILE_SOIL;
  }
  _typeCache.set(key, type);
  return type;
}

// Deterministic per-tile RNG — same tile always looks the same
function _makeRng(tx, ty) {
  let s = ((tx * 1234567) ^ (ty * 7654321) ^ 99991) | 0;
  return function () {
    s = (Math.imul(s ^ (s >>> 15), 0x4e995bf1)) | 0;
    s = (Math.imul(s ^ (s >>> 12), 0x4e995bf1)) | 0;
    return ((s ^ (s >>> 15)) >>> 0) / 0xffffffff;
  };
}

// ─── Public ───────────────────────────────────────────────────

function drawTerrain(ctx, viewport, zones, cw, ch) {
  // Viewport-cull: only draw tiles actually on screen
  const x0 = (0  - viewport.x) / viewport.zoom;
  const y0 = (0  - viewport.y) / viewport.zoom;
  const x1 = (cw - viewport.x) / viewport.zoom;
  const y1 = (ch - viewport.y) / viewport.zoom;

  const tx0 = Math.floor(x0 / TILE_SIZE) - 1;
  const ty0 = Math.floor(y0 / TILE_SIZE) - 1;
  const tx1 = Math.ceil(x1  / TILE_SIZE) + 1;
  const ty1 = Math.ceil(y1  / TILE_SIZE) + 1;

  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      _drawTile(ctx, tx, ty, zones, viewport.zoom);
    }
  }
}

// ─── Tile draw ────────────────────────────────────────────────

function _drawTile(ctx, tx, ty, zones, zoom) {
  const type = _getType(tx, ty, zones);
  const rand = _makeRng(tx, ty);
  const wx   = tx * TILE_SIZE;
  const wy   = ty * TILE_SIZE;
  const s    = TILE_SIZE;

  const palette = type === TILE_GRASS ? GRASS_COLORS
                : type === TILE_SOIL  ? SOIL_COLORS
                : EXT_COLORS;

  ctx.fillStyle = palette[Math.floor(rand() * palette.length)];
  ctx.fillRect(wx, wy, s, s);

  if      (type === TILE_GRASS) _grassDetails(ctx, wx, wy, s, rand, zoom);
  else if (type === TILE_SOIL)  _soilDetails(ctx, wx, wy, s, rand, zoom);
  else                          _extDetails(ctx, wx, wy, s, rand, zoom);
}

// ─── Grass ────────────────────────────────────────────────────

function _grassDetails(ctx, wx, wy, s, rand, zoom) {
  // Ambient light — top-left highlight, bottom shadow
  ctx.fillStyle = 'rgba(255,255,255,0.07)';
  ctx.fillRect(wx, wy, s, 2);
  ctx.fillRect(wx, wy, 2, s);
  ctx.fillStyle = 'rgba(0,0,0,0.09)';
  ctx.fillRect(wx, wy + s - 2, s, 2);

  // Occasional shadow blob (dappled light / slight depression)
  if (rand() > 0.62) {
    const pr = 3 + rand() * 5;
    const px = wx + pr + rand() * (s - pr * 2);
    const py = wy + pr + rand() * (s - pr * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.07)';
    ctx.beginPath();
    ctx.ellipse(px, py, pr, pr * 0.65, rand() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }

  if (zoom < 1.5) return;

  // ── Grass tufts (2–4 per tile) ──
  const n = 2 + Math.floor(rand() * 3);
  ctx.strokeStyle = 'rgba(55, 105, 30, 0.70)';
  ctx.lineWidth   = Math.max(0.4, 0.7 / zoom);
  ctx.lineCap     = 'round';
  for (let i = 0; i < n; i++) {
    const bx = wx + 3 + rand() * (s - 6);
    const by = wy + 4 + rand() * (s - 7);
    const h  = 1.6 + rand() * 2.0;
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx - h * 0.55, by - h);        ctx.stroke();
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + h * 0.55, by - h);        ctx.stroke();
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx,             by - h * 1.2); ctx.stroke();
  }

  if (zoom < 2.5) return;

  // ── Occasional wildflower (1-in-5 tiles) ──
  if (rand() > 0.80) {
    const fx = wx + 4 + rand() * (s - 8);
    const fy = wy + 4 + rand() * (s - 8);
    const FLOWER_COLORS = ['#ffcc44','#ff9999','#cc88ff','#ffffff','#ffbbcc','#88ddff'];
    // Petals
    ctx.fillStyle = FLOWER_COLORS[Math.floor(rand() * FLOWER_COLORS.length)];
    for (let p = 0; p < 5; p++) {
      const angle = (p / 5) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(fx + Math.cos(angle) * 1.3, fy + Math.sin(angle) * 1.3, 1.1, 0, Math.PI * 2);
      ctx.fill();
    }
    // Centre
    ctx.fillStyle = '#ffe066';
    ctx.beginPath();
    ctx.arc(fx, fy, 0.8, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ─── Soil (garden beds) ───────────────────────────────────────

function _soilDetails(ctx, wx, wy, s, rand, zoom) {
  const rowGap = 4; // world px between tilled rows

  // Dark furrows
  ctx.lineWidth   = 0.8;
  ctx.strokeStyle = 'rgba(0,0,0,0.20)';
  for (let ry = wy + rowGap; ry < wy + s; ry += rowGap) {
    ctx.beginPath(); ctx.moveTo(wx, ry); ctx.lineTo(wx + s, ry); ctx.stroke();
  }
  // Light ridges between furrows
  ctx.strokeStyle = 'rgba(255,255,255,0.09)';
  for (let ry = wy + rowGap * 0.5; ry < wy + s; ry += rowGap) {
    ctx.beginPath(); ctx.moveTo(wx, ry); ctx.lineTo(wx + s, ry); ctx.stroke();
  }
  // Bottom edge shadow
  ctx.fillStyle = 'rgba(0,0,0,0.11)';
  ctx.fillRect(wx, wy + s - 1, s, 1);

  if (zoom < 2) return;

  // ── Pebbles ──
  const n = Math.floor(rand() * 3); // 0–2
  for (let i = 0; i < n; i++) {
    const px = wx + 2 + rand() * (s - 4);
    const py = wy + 2 + rand() * (s - 4);
    const pr = 0.6 + rand() * 0.9;
    const gr = 130 + Math.floor(rand() * 50);
    ctx.fillStyle = `rgba(${160 + Math.floor(rand()*35)},${gr},${100 + Math.floor(rand()*30)},0.72)`;
    ctx.beginPath();
    ctx.ellipse(px, py, pr, pr * 0.65, rand() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ─── Exterior (outside property) ──────────────────────────────

function _extDetails(ctx, wx, wy, s, rand, zoom) {
  // Tree canopy blobs — suggests dense vegetation outside
  const n = 1 + Math.floor(rand() * 3);
  for (let i = 0; i < n; i++) {
    const pr = 4 + rand() * 8;
    const px = wx + rand() * s;
    const py = wy + rand() * s;
    ctx.fillStyle = 'rgba(0,0,0,0.13)';
    ctx.beginPath();
    ctx.arc(px, py, pr, 0, Math.PI * 2);
    ctx.fill();
  }
  // Rare gap in canopy (lighter circle)
  if (rand() > 0.78) {
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    ctx.beginPath();
    ctx.arc(wx + rand() * s, wy + rand() * s, 2 + rand() * 5, 0, Math.PI * 2);
    ctx.fill();
  }
}
