// Zone polygon coordinates in image-pixel space (954 × 972 image)
// Scale: 5 px/ft  (driveway = 40px = 8ft, property 880px N–S = 176ft ≈ 60 yds)
// All corners snapped to 1ft grid (multiples of 5px).
// Calibrated via zone editor + export 2026-06-13.
// Bump ZONE_VERSION to force-replace stale localStorage data.

const ZONE_VERSION = 4;

const DEFAULT_ZONES = {
  version: ZONE_VERSION,
  property: {
    id: 'property',
    label: 'Property Boundary',
    strokeColor: '#ff4444',
    fillColor: 'rgba(255, 68, 68, 0.08)',
    lineWidth: 3,
    points: [
      [715, 40], [930, 40], [930, 460], [930, 920],
      [640, 750], [450, 645], [550, 440], [630, 235]
    ]
  },
  gardens: [
    {
      id: 'garden_house',
      label: 'Garden (near house)',
      strokeColor: '#44dd44',
      fillColor: 'rgba(68, 221, 68, 0.15)',
      lineWidth: 2.5,
      points: [
        [845, 210], [845, 240], [710, 240], [710, 390],
        [765, 390], [760, 415], [700, 415], [700, 220]
      ]
    },
    {
      id: 'garden_main',
      label: 'Main Garden',
      strokeColor: '#44dd44',
      fillColor: 'rgba(68, 221, 68, 0.15)',
      lineWidth: 2.5,
      points: [
        [860, 850], [860, 540], [930, 540], [930, 920],
        [510, 675], [540, 595], [580, 600], [580, 665], [665, 735]
      ]
    }
  ],
  // Sun zones are defined as regions of the property
  // SE corner = full sun, SW corner = full shade
  sunZones: {
    fullSun: {
      label: 'Full Sun',
      color: 'rgba(255, 215, 0, 0.22)',
      // Rough SE triangle of the property bounding box
      percentOfBounds: { x: 0.55, y: 0.5, w: 0.45, h: 0.5 }
    },
    fullShade: {
      label: 'Full Shade',
      color: 'rgba(60, 100, 60, 0.25)',
      // Rough SW triangle of the property bounding box
      percentOfBounds: { x: 0.0, y: 0.5, w: 0.45, h: 0.5 }
    }
  }
};

// Load zones: use localStorage only if version matches, otherwise use calibrated defaults
function loadZones() {
  const saved = localStorage.getItem('yardsim_zones');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (parsed.version === ZONE_VERSION) return parsed;
      // Version mismatch — fall through to defaults and overwrite
      console.info(`Zone version mismatch (stored ${parsed.version}, current ${ZONE_VERSION}), resetting to defaults`);
    } catch (e) {
      console.warn('Failed to parse saved zones, using defaults');
    }
  }
  const defaults = JSON.parse(JSON.stringify(DEFAULT_ZONES));
  localStorage.setItem('yardsim_zones', JSON.stringify(defaults)); // seed immediately
  return defaults;
}

function saveZones(zones) {
  zones.version = ZONE_VERSION;
  localStorage.setItem('yardsim_zones', JSON.stringify(zones));
}

// Utility: point-in-polygon (ray casting)
function pointInPolygon(x, y, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const xi = points[i][0], yi = points[i][1];
    const xj = points[j][0], yj = points[j][1];
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  return inside;
}

function getBoundingBox(points) {
  const xs = points.map(p => p[0]);
  const ys = points.map(p => p[1]);
  return {
    minX: Math.min(...xs), maxX: Math.max(...xs),
    minY: Math.min(...ys), maxY: Math.max(...ys)
  };
}
