// Plant & structure catalog for YardSim
// SW Ohio (USDA zone 6a/6b) — last spring frost ≈ Apr 15, first fall frost ≈ Oct 15

const CATALOG = {

  plants: [
    // ── Warm season (plant after May 10–15) ──────────────────
    { id:'tomato',        name:'Tomato',        emoji:'🍅', category:'vegetable',
      isTuber:false, sunNeeds:'full',    spacingFt:2,
      plantStart:'May 10', plantEnd:'Jun 15', daysToHarvest:[60,85],
      companions:['basil','marigold','carrot'],  antagonists:['fennel'],
      notes:'Stake or cage early. Harden off starts before transplanting.' },

    { id:'cherry_tomato', name:'Cherry Tomato', emoji:'🍒', category:'vegetable',
      isTuber:false, sunNeeds:'full',    spacingFt:2,
      plantStart:'May 10', plantEnd:'Jun 15', daysToHarvest:[55,70],
      companions:['basil','marigold'],           antagonists:['fennel'],
      notes:'Very productive. Great for snacking straight from the vine.' },

    { id:'pepper',        name:'Pepper',        emoji:'🫑', category:'vegetable',
      isTuber:false, sunNeeds:'full',    spacingFt:1.5,
      plantStart:'May 15', plantEnd:'Jun 15', daysToHarvest:[70,90],
      companions:['basil','carrot'],             antagonists:['fennel'],
      notes:'Loves heat. Start indoors 8–10 weeks before transplant.' },

    { id:'zucchini',      name:'Zucchini',      emoji:'🥒', category:'vegetable',
      isTuber:false, sunNeeds:'full',    spacingFt:3,
      plantStart:'May 10', plantEnd:'Jun 1',  daysToHarvest:[50,65],
      companions:['nasturtium','marigold'],       antagonists:[],
      notes:'One or two plants produce abundantly. Harvest often.' },

    { id:'cucumber',      name:'Cucumber',      emoji:'🥒', category:'vegetable',
      isTuber:false, sunNeeds:'full',    spacingFt:2,
      plantStart:'May 10', plantEnd:'Jun 1',  daysToHarvest:[50,70],
      companions:['dill','sunflower'],           antagonists:['sage'],
      notes:'Train up a trellis to save space and improve air flow.' },

    { id:'green_bean',    name:'Green Bean',    emoji:'🫘', category:'vegetable',
      isTuber:false, sunNeeds:'full',    spacingFt:0.5,
      plantStart:'May 1',  plantEnd:'Jun 15', daysToHarvest:[50,60],
      companions:['carrot','strawberry'],         antagonists:['fennel'],
      notes:'Direct sow. Succession plant every 2–3 weeks for continuous harvest.' },

    { id:'pole_bean',     name:'Pole Bean',     emoji:'🫘', category:'vegetable',
      isTuber:false, sunNeeds:'full',    spacingFt:0.5,
      plantStart:'May 1',  plantEnd:'Jun 15', daysToHarvest:[60,75],
      companions:['carrot','cucumber'],           antagonists:['fennel'],
      notes:'Needs a trellis. More productive per sq ft than bush beans.' },

    { id:'sunflower',     name:'Sunflower',     emoji:'🌻', category:'flower',
      isTuber:false, sunNeeds:'full',    spacingFt:1.5,
      plantStart:'May 1',  plantEnd:'Jun 1',  daysToHarvest:[70,100],
      companions:['cucumber','squash'],           antagonists:[],
      notes:'Excellent for pollinators. Leave seed heads for birds in fall.' },

    { id:'basil',         name:'Basil',         emoji:'🌿', category:'herb',
      isTuber:false, sunNeeds:'full',    spacingFt:1,
      plantStart:'May 15', plantEnd:'Jun 15', daysToHarvest:[25,35],
      companions:['tomato','pepper'],             antagonists:['sage'],
      notes:'Plant near tomatoes — repels aphids. Pinch flowers to extend season.' },

    { id:'marigold',      name:'Marigold',      emoji:'🌸', category:'flower',
      isTuber:false, sunNeeds:'full',    spacingFt:1,
      plantStart:'May 1',  plantEnd:'Jun 1',  daysToHarvest:[50,60],
      companions:['tomato','pepper','bean'],       antagonists:[],
      notes:'Excellent pest deterrent throughout the garden.' },

    { id:'nasturtium',    name:'Nasturtium',    emoji:'🌺', category:'flower',
      isTuber:false, sunNeeds:'full',    spacingFt:1,
      plantStart:'May 1',  plantEnd:'Jun 1',  daysToHarvest:[50,60],
      companions:['zucchini','cucumber'],         antagonists:[],
      notes:'Edible flowers and leaves. Great aphid trap at garden edges.' },

    { id:'strawberry',    name:'Strawberry',    emoji:'🍓', category:'fruit',
      isTuber:false, sunNeeds:'full',    spacingFt:1,
      plantStart:'Apr 15', plantEnd:'May 15', daysToHarvest:[28,35],
      companions:['spinach','bean'],             antagonists:['brassica'],
      notes:'Perennial — returns each year. Spreads via runners.' },

    // ── Cool season (plant Mar–Apr, before heat) ─────────────
    { id:'snap_pea',      name:'Snap Pea',      emoji:'🫛', category:'vegetable',
      isTuber:false, sunNeeds:'full',    spacingFt:0.5,
      plantStart:'Mar 15', plantEnd:'Apr 30', daysToHarvest:[60,70],
      companions:['carrot','lettuce'],           antagonists:['garlic'],
      notes:'Plant 4–6 weeks before last frost. Provide a trellis.' },

    { id:'lettuce',       name:'Lettuce',       emoji:'🥬', category:'vegetable',
      isTuber:false, sunNeeds:'partial', spacingFt:0.5,
      plantStart:'Mar 20', plantEnd:'May 1',  daysToHarvest:[45,60],
      companions:['carrot','radish'],             antagonists:[],
      notes:'Cut-and-come-again. Tolerates partial shade — good under taller plants.' },

    { id:'spinach',       name:'Spinach',       emoji:'🥬', category:'vegetable',
      isTuber:false, sunNeeds:'partial', spacingFt:0.5,
      plantStart:'Mar 15', plantEnd:'Apr 20', daysToHarvest:[40,50],
      companions:['strawberry','pea'],           antagonists:[],
      notes:'Bolts quickly in heat. Excellent for shaded spots.' },

    { id:'kale',          name:'Kale',          emoji:'🥬', category:'vegetable',
      isTuber:false, sunNeeds:'partial', spacingFt:1.5,
      plantStart:'Mar 20', plantEnd:'Apr 30', daysToHarvest:[55,70],
      companions:['dill'],                       antagonists:['strawberry'],
      notes:'Gets sweeter after frost. Very cold-hardy.' },

    { id:'chard',         name:'Swiss Chard',   emoji:'🌿', category:'vegetable',
      isTuber:false, sunNeeds:'partial', spacingFt:1,
      plantStart:'Apr 1',  plantEnd:'May 15', daysToHarvest:[50,60],
      companions:['lettuce'],                    antagonists:[],
      notes:'Tolerates more heat than other greens. Cut outer leaves.' },

    { id:'arugula',       name:'Arugula',       emoji:'🌿', category:'vegetable',
      isTuber:false, sunNeeds:'partial', spacingFt:0.5,
      plantStart:'Mar 15', plantEnd:'Apr 20', daysToHarvest:[30,40],
      companions:['lettuce','spinach'],          antagonists:[],
      notes:'Very fast. Gets spicy in heat — harvest young.' },

    { id:'dill',          name:'Dill',          emoji:'🌿', category:'herb',
      isTuber:false, sunNeeds:'full',    spacingFt:1,
      plantStart:'Apr 20', plantEnd:'May 30', daysToHarvest:[40,60],
      companions:['cucumber','lettuce'],         antagonists:['carrot','tomato'],
      notes:'Attracts beneficial insects. Let some go to seed for next year.' },

    { id:'cilantro',      name:'Cilantro',      emoji:'🌿', category:'herb',
      isTuber:false, sunNeeds:'partial', spacingFt:0.5,
      plantStart:'Apr 1',  plantEnd:'May 15', daysToHarvest:[45,70],
      companions:['spinach','lettuce'],          antagonists:[],
      notes:'Bolts in heat. Succession sow every 3–4 weeks.' },

    { id:'chives',        name:'Chives',        emoji:'🌿', category:'herb',
      isTuber:false, sunNeeds:'full',    spacingFt:0.5,
      plantStart:'Apr 1',  plantEnd:'May 15', daysToHarvest:[60,90],
      companions:['tomato','carrot'],            antagonists:[],
      notes:'Perennial. Great pest deterrent. Pretty purple flowers.' },

    // ── Tubers — trigger soil-health warning ─────────────────
    { id:'carrot',        name:'Carrot',        emoji:'🥕', category:'vegetable',
      isTuber:true,  sunNeeds:'full',    spacingFt:0.25,
      plantStart:'Apr 1',  plantEnd:'May 15', daysToHarvest:[70,80],
      companions:['tomato','lettuce'],           antagonists:['dill'],
      notes:'Loosen soil 12" deep. Thin seedlings to 2" apart.' },

    { id:'radish',        name:'Radish',        emoji:'🔴', category:'vegetable',
      isTuber:true,  sunNeeds:'full',    spacingFt:0.25,
      plantStart:'Mar 25', plantEnd:'May 1',  daysToHarvest:[25,30],
      companions:['lettuce','pea'],              antagonists:[],
      notes:'Fastest crop. Great as row markers between slower plants.' },

    { id:'beet',          name:'Beet',          emoji:'🟣', category:'vegetable',
      isTuber:true,  sunNeeds:'full',    spacingFt:0.25,
      plantStart:'Apr 1',  plantEnd:'May 15', daysToHarvest:[55,70],
      companions:['lettuce'],                    antagonists:['bean'],
      notes:'Both greens and roots are edible and delicious.' },

    { id:'potato',        name:'Potato',        emoji:'🥔', category:'vegetable',
      isTuber:true,  sunNeeds:'full',    spacingFt:1,
      plantStart:'Apr 15', plantEnd:'May 15', daysToHarvest:[70,90],
      companions:['bean'],                       antagonists:['tomato','cucumber'],
      notes:'Hill soil around stems as they grow. Cure before storing.' },

    { id:'sweet_potato',  name:'Sweet Potato',  emoji:'🍠', category:'vegetable',
      isTuber:true,  sunNeeds:'full',    spacingFt:1,
      plantStart:'May 15', plantEnd:'Jun 1',  daysToHarvest:[90,120],
      companions:[],                             antagonists:[],
      notes:'Needs long, warm season. Start slips indoors 6 weeks out.' },
  ],

  structures: [
    { id:'hay_bale',        name:'Hay Bale',         emoji:'🌾', category:'structure',
      widthFt:4, heightFt:2,
      notes:'Mulch source and planting medium. Great weed suppressor.' },

    { id:'mini_hay_bale',   name:'Mini Bale',         emoji:'🌾', category:'structure',
      widthFt:2, heightFt:1,
      notes:'Smaller bale for narrow beds or pathways.' },

    { id:'trellis_aframe',  name:'A-Frame Trellis',  emoji:'🪵', category:'structure',
      widthFt:4, heightFt:1,
      notes:'Supports pole beans, cucumbers, peas. Fold for storage.' },

    { id:'trellis_flat',    name:'Flat Trellis',     emoji:'🪵', category:'structure',
      widthFt:6, heightFt:1,
      notes:'Post-mounted or leaned against a fence.' },

    { id:'raised_bed_4x8',  name:'Raised Bed (4×8)', emoji:'🟫', category:'structure',
      widthFt:8, heightFt:4,
      notes:'Standard bed. Fill with fresh amended soil — great for this property.' },

    { id:'raised_bed_4x4',  name:'Raised Bed (4×4)', emoji:'🟫', category:'structure',
      widthFt:4, heightFt:4,
      notes:'Compact bed — all areas reachable from the sides.' },

    { id:'cold_frame',      name:'Cold Frame',       emoji:'🪟', category:'structure',
      widthFt:4, heightFt:2,
      notes:'Extends season by 4–6 weeks in spring and fall.' },

    { id:'compost_bin',     name:'Compost Bin',      emoji:'♻️', category:'structure',
      widthFt:3, heightFt:3,
      notes:'Keep moist and turn weekly. Good use of a partial-shade spot.' },

    { id:'rain_barrel',     name:'Rain Barrel',      emoji:'🪣', category:'structure',
      widthFt:2, heightFt:2,
      notes:'Connect to a downspout. Significant water savings in summer.' },

    { id:'chicken_coop',    name:'Chicken Coop',     emoji:'🐔', category:'structure',
      widthFt:8, heightFt:6,
      notes:'Your girls need ~4 sq ft each inside. Add a covered run outside.' },

    { id:'bird_bath',       name:'Bird Bath',        emoji:'🐦', category:'structure',
      widthFt:2, heightFt:2,
      notes:'Attracts insect-eating birds and pollinators.' },

    { id:'stepping_stone',  name:'Stepping Stone',  emoji:'⬛', category:'structure',
      widthFt:1, heightFt:1,
      notes:'Mark paths through garden beds.' },

    { id:'garden_stake',    name:'Garden Stake',     emoji:'🪧', category:'structure',
      widthFt:0.5, heightFt:0.5,
      notes:'Label plants or mark seed rows.' },
  ]
};

// ─── Helpers ──────────────────────────────────────────────────

function getCatalogEntry(id) {
  return CATALOG.plants.find(p => p.id === id)
      || CATALOG.structures.find(s => s.id === id)
      || null;
}

function isPlant(entry) {
  return !!entry && !entry.widthFt;
}

function isStructure(entry) {
  return !!entry && !!entry.widthFt;
}

// Returns today's date formatted as "Mon DD"
function todayLabel() {
  return new Date().toLocaleDateString('en-US', { month:'short', day:'numeric' });
}

// True if today falls within the SW Ohio planting window
function inPlantingWindow(entry) {
  if (!entry.plantStart) return false;
  const year  = new Date().getFullYear();
  const today = new Date();
  const start = new Date(`${entry.plantStart} ${year}`);
  const end   = entry.plantEnd ? new Date(`${entry.plantEnd} ${year}`) : start;
  return today >= start && today <= end;
}

// Label for when to plant relative to today
function plantingStatus(entry) {
  if (!entry.plantStart) return '';
  const year  = new Date().getFullYear();
  const today = new Date();
  const start = new Date(`${entry.plantStart} ${year}`);
  const end   = entry.plantEnd ? new Date(`${entry.plantEnd} ${year}`) : start;
  if (today < start) {
    const days = Math.ceil((start - today) / 86400000);
    return days <= 7 ? `Plant in ${days}d` : `Plant after ${entry.plantStart}`;
  }
  if (today > end) return `Best window passed (${entry.plantEnd})`;
  return '🌱 Plant now!';
}

// Estimated harvest date given a plant date
function estimatedHarvest(entry, plantedDateStr) {
  if (!entry.daysToHarvest || !plantedDateStr) return '';
  const planted = new Date(plantedDateStr);
  const [minD, maxD] = entry.daysToHarvest;
  const minH = new Date(planted); minH.setDate(minH.getDate() + minD);
  const maxH = new Date(planted); maxH.setDate(maxH.getDate() + maxD);
  const fmt  = d => d.toLocaleDateString('en-US', { month:'short', day:'numeric' });
  return `${fmt(minH)} – ${fmt(maxH)}`;
}

const SUN_LABEL = { full:'☀️ Full sun', partial:'🌤 Partial shade', shade:'🌑 Full shade' };
const CAT_ORDER_PLANTS = ['vegetable','herb','flower','fruit'];
