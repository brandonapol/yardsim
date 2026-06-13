# YardSim — Technical TODO

A browser-based homestead/farm planning game built around a real satellite image of the property.
Target: SW Ohio seasonal data, ~3/4 acre, full sun SE corner, full shade SW corner.

---

## Phase 1 — Foundation & Map Rendering

### 1.1 Project Setup
- [ ] Single-file or minimal multi-file vanilla JS + HTML5 Canvas (no framework needed)
- [ ] `index.html`, `style.css`, `main.js`, `data/plants.js`, `data/items.js`
- [ ] Establish a coordinate system: pixel space on the canvas maps to real-world feet/meters
  - Property is ~3/4 acre; establish a scale factor (e.g. 1 canvas px = N feet)

### 1.2 Background Map
- [ ] Use the satellite image as canvas background (drawImage)
- [ ] Crop/scale the image so the red property perimeter aligns with the canvas edges cleanly
- [ ] Store original image dimensions and the transformation matrix so coordinates are reproducible

### 1.3 Zone Overlay System
- [ ] Define zones as polygon point arrays (in canvas-pixel space, traced from the photo):
  - `PROPERTY_PERIMETER` — red outline
  - `GARDEN_BEDS[]` — each green outline as its own named polygon
  - `SUN_ZONES` — at minimum: `FULL_SUN` (SE), `FULL_SHADE` (SW), `PARTIAL` (rest)
- [ ] Render zones as semi-transparent colored overlays (toggleable)
- [ ] Layer order: satellite bg → sun/shade overlay → garden outlines → placed items → UI

### 1.4 Camera / Pan-Zoom
- [ ] Mouse wheel zoom centered on cursor
- [ ] Click-drag pan
- [ ] Zoom limits (don't zoom out past property, don't zoom in past ~1ft/px)
- [ ] All coordinate transforms go through a single `worldToCanvas` / `canvasToWorld` helper

---

## Phase 2 — Item Catalog & Placement

### 2.1 Item Types
Two categories of placeable things:
- **Structures**: hay bale, trellis, raised bed frame, fence section, compost bin, cold frame
- **Plants**: seeds/starts — each has a species entry in `plants.js`

### 2.2 Plant Data Schema (`data/plants.js`)
Each plant entry should have:
```js
{
  id: 'tomato',
  name: 'Tomato',
  emoji: '🍅',        // fallback icon before we have art
  category: 'vegetable',
  isTuber: false,      // triggers soil-health warning if true
  sunNeeds: 'full',    // 'full' | 'partial' | 'shade'
  spacingFt: 2,        // radius of space needed per plant
  companions: ['basil', 'carrot'],
  antagonists: ['fennel'],
  swOhioPlantAfter: 'last-frost',   // reference to frost date constants
  swOhioPlantBefore: 'Jun-15',
  daysToHarvest: [60, 85],
  notes: ''
}
```
Frost dates for SW Ohio (Cincinnati/Dayton area):
- Last spring frost: ~April 15
- First fall frost: ~October 15

### 2.3 Structure Data Schema (`data/items.js`)
```js
{
  id: 'hay-bale',
  name: 'Hay Bale',
  emoji: '🌾',
  widthFt: 4,
  heightFt: 2,
  blocksSun: false,
  notes: 'Good mulch source; can be used as a planting medium'
}
```

### 2.4 Placement System
- [ ] Item palette panel (sidebar or bottom tray): click to select, then click canvas to place
- [ ] While placing: ghost/preview renders under cursor, snaps to a grid (configurable, default 1ft)
- [ ] Right-click or Escape cancels placement
- [ ] Each placed item stored as:
  ```js
  { id: uuid, type: 'plant'|'structure', catalogId, x, y, rotation, placedDate }
  ```
- [ ] Placed items render as emoji or sprite at world coordinates
- [ ] Click a placed item to select it (shows info panel, allows delete/rotate)
- [ ] Drag placed items to reposition

### 2.5 Collision / Spacing Awareness
- [ ] When previewing placement, highlight if it overlaps another item's spacing radius (red ghost)
- [ ] Show spacing radius rings on hover/select (dashed circle = recommended clear zone)
- [ ] Warn (not block) if a plant is placed in a mismatched sun zone

---

## Phase 3 — Plant Intelligence & Advisories

### 3.1 Sun Zone Validation
- [ ] On placement, check which sun polygon the item lands in
- [ ] If `plant.sunNeeds !== zone.sunLevel`: show advisory banner ("Tomatoes prefer full sun — this spot is partial shade")
- [ ] Advisory is dismissable, placement not blocked

### 3.2 Soil Health Warning (Tuber Alert)
- [ ] Any plant where `isTuber: true` triggers a modal on placement:
  > "Heads up — root crops like [plant name] grow below soil level. Given potential soil quality concerns, are you sure you want to plant this here?"
- [ ] Two buttons: "Plant anyway" / "Cancel"
- [ ] Flag tubers: carrot, potato, radish, beet, turnip, parsnip, sweet potato, rutabaga, yam, celeriac, kohlrabi

### 3.3 Planting Calendar
- [ ] A collapsible "Calendar" panel showing a timeline (Jan–Dec)
- [ ] Each placed plant shows its planting window and estimated harvest window as a colored bar
- [ ] "Plant now" indicator for current month
- [ ] Warning if a plant is placed outside its planting window for SW Ohio

### 3.4 Space-to-Harvest Projection
- [ ] When a plant is selected, info panel shows:
  - Spacing circle on map
  - "Will need X ft² of space"
  - "Ready to harvest around [date range]" based on placedDate + daysToHarvest
  - Companion/antagonist callouts for nearby placed plants

### 3.5 Companion Planting Overlay (stretch)
- [ ] Toggle that tints placed items green (good neighbor nearby) or red (antagonist nearby)

---

## Phase 4 — Persistence (LocalStorage)

### 4.1 Save/Load
- [ ] Auto-save the full game state to `localStorage['yardsim_state']` on every change (debounced 500ms)
- [ ] State shape:
  ```js
  {
    version: 1,
    placedItems: [...],
    viewport: { x, y, zoom },
    lastSaved: ISO timestamp
  }
  ```
- [ ] On load, restore placed items and viewport
- [ ] Schema version field for future migrations

### 4.2 Multiple Saves / Named Plans (stretch)
- [ ] Allow saving named "plans" (e.g. "Spring 2026", "Dream Layout") as separate localStorage keys
- [ ] Plan switcher in UI

### 4.3 Export
- [ ] "Export as JSON" button — downloads the state as a `.json` file
- [ ] "Export as PNG" — renders the current canvas view to a downloadable image (for sharing)

---

## Phase 5 — UI / UX Shell

### 5.1 Layout
- Left sidebar: item palette (tabs: Plants / Structures / Search)
- Right panel (collapsible): selected item details + advisories
- Bottom bar: calendar timeline strip
- Top bar: plan name, save indicator, zoom controls, layer toggles

### 5.2 Layer Toggles
- [ ] Sun/shade overlay on/off
- [ ] Spacing rings on/off
- [ ] Garden bed outlines on/off
- [ ] Grid on/off

### 5.3 Seasonal View
- [ ] "View as: Spring / Summer / Fall / Winter" toggle
- [ ] Changes which plants show their active growth state visually

### 5.4 Visual Style
- [ ] Cozy/earthy color palette — think stardew valley meets google maps
- [ ] Pixel art sprites for items (can start with emoji, upgrade later)
- [ ] Smooth canvas animations for placement

---

## Phase 6 — Content & Data

### 6.1 Seed/Plant Library (SW Ohio focused)
Priority plants to add first (common homestead crops that grow well in zone 6a/6b):
- Tomato, pepper, zucchini, cucumber, beans (pole + bush), peas
- Lettuce, spinach, kale, chard, arugula
- Basil, dill, cilantro, parsley, chives, oregano, thyme, rosemary
- Sunflower, marigold, nasturtium (pest deterrents)
- Winter squash, pumpkin
- Strawberry, raspberry (perennial)
- Tubers (with warning): carrot, radish, beet, potato, sweet potato, turnip

### 6.2 Structure Library
- Hay bale, mini hay bale, trellis (A-frame, flat), raised bed (4x8, 4x4, custom)
- Compost bin, cold frame, row cover, rain barrel, garden stake, bird bath, stepping stone

### 6.3 Weather/Season Data (SW Ohio defaults)
- Zone: USDA 6a (parts of SW Ohio) to 6b
- Last spring frost: April 15
- First fall frost: October 15
- Average rainfall: ~40in/year, fairly even distribution
- Hot/humid summers; cold winters with occasional snow

---

## Phase 7 — Polish & Extras (Backlog)

- [ ] Mobile/touch support (pinch zoom, tap to place)
- [ ] Undo/redo stack (Ctrl+Z)
- [ ] Notes field on each placed item ("got these seeds from the farmers market")
- [ ] Photo attach to a placed item (IndexedDB for blobs)
- [ ] "What can I plant right now?" quick-filter based on today's date
- [ ] Yield estimator ("your 3 tomato plants should produce ~30–60 lbs this season")
- [ ] QR code share link (encode state in URL or use a tiny backend)
- [ ] Service worker for offline use (PWA)

---

## Implementation Order (Recommended)

1. **Phase 1** — Get the map on screen with zones drawn
2. **Phase 2.1–2.4** — Palette + placement (even with placeholder emoji art)
3. **Phase 4.1** — LocalStorage save/load immediately (don't lose work)
4. **Phase 3.2** — Tuber soil warning (quick win, high meaning)
5. **Phase 3.1** — Sun zone validation
6. **Phase 2.5** — Spacing collision
7. **Phase 3.3** — Calendar panel
8. **Phase 6** — Fill out plant/item data
9. **Phase 5** — UI polish
10. Everything else
