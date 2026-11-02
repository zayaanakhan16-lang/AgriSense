import type { CropProfile } from '@/types';

/**
 * Demonstration crop profile dataset for the deterministic rules engine.
 *
 * These 68 profiles are labelled demonstration data: they are agronomically plausible
 * reference values, not a live rules-engine dataset. When `VITE_AGRISENSE_API_URL` is
 * configured the connected rules engine replaces this file entirely, and the UI labels
 * every result with its origin so demonstration values are never presented as
 * authoritative agronomic calculations.
 */

type CropCategory = CropProfile['category'];
type WaterClass = CropProfile['waterClass'];
type Tolerance = CropProfile['droughtTolerance'];

/** Texture codes: L loam · SL sandy loam · CL clay loam · C clay · SCL sandy clay loam
 *  LS loamy sand · SiL silt loam · SiCL silty clay loam · SC sandy clay · SiC silty clay
 *  Si silt · S sand */
const TEXTURE_CODES: Record<string, string> = {
  L: 'Loam',
  SL: 'Sandy loam',
  CL: 'Clay loam',
  C: 'Clay',
  SCL: 'Sandy clay loam',
  LS: 'Loamy sand',
  SiL: 'Silt loam',
  SiCL: 'Silty clay loam',
  SC: 'Sandy clay',
  SiC: 'Silty clay',
  Si: 'Silt',
  S: 'Sand',
};

function c(
  id: string,
  name: string,
  scientificName: string,
  category: CropCategory,
  water: [number, number],
  waterClass: WaterClass,
  ph: [number, number, number, number],
  temp: [number, number, number, number],
  textures: string,
  plant: number[],
  harvest: number[],
  cycleDays: number,
  drought: Tolerance,
  salinity: Tolerance,
  drainage: Tolerance,
  notes: string,
): CropProfile {
  return {
    id,
    name,
    scientificName,
    category,
    waterRequirementMm: { min: water[0], max: water[1] },
    waterClass,
    optimalPh: [ph[0], ph[1]],
    toleratedPh: [ph[2], ph[3]],
    optimalTempC: [temp[0], temp[1]],
    absoluteTempC: [temp[2], temp[3]],
    soilTextures: textures.split('|').map((code) => TEXTURE_CODES[code] ?? code),
    plantingMonths: plant,
    harvestMonths: harvest,
    cycleDays,
    droughtTolerance: drought,
    salinityTolerance: salinity,
    drainageNeed: drainage,
    notes,
  };
}

export const CROP_PROFILES: CropProfile[] = [
  // ---------------------------------------------------------------- cereals
  c('wheat', 'Wheat', 'Triticum aestivum', 'cereal', [450, 650], 'moderate', [6, 7.5, 5.5, 8.5], [15, 24, -2, 35], 'L|CL|SiL|SCL', [10, 11, 0], [3, 4], 150, 'moderate', 'moderate', 'moderate', 'Cool-season cereal. Best yields on well-structured loam with steady moisture through tillering and grain fill.'),
  c('durum-wheat', 'Durum wheat', 'Triticum durum', 'cereal', [400, 600], 'moderate', [6.5, 8, 6, 8.8], [17, 26, 0, 36], 'CL|L|SiL|C', [10, 11, 0], [4, 5], 165, 'high', 'moderate', 'moderate', 'Drought-tolerant pasta wheat. Prefers warm, dry finishing conditions and heavier soils.'),
  c('barley', 'Barley', 'Hordeum vulgare', 'cereal', [350, 500], 'low', [6.5, 8, 5.8, 8.8], [12, 22, -6, 35], 'L|SL|CL|SCL', [10, 11, 0, 1], [3, 4, 5], 130, 'high', 'high', 'moderate', 'The most salt- and drought-tolerant cereal. Suits marginal soils and short seasons.'),
  c('maize', 'Maize', 'Zea mays', 'cereal', [500, 800], 'high', [5.8, 7.2, 5, 8], [22, 32, 8, 40], 'L|SL|SiL|CL', [3, 4, 5, 6], [8, 9, 10], 120, 'low', 'low', 'high', 'Warm-season high-yield cereal. Highly responsive to nitrogen and irrigation; intolerant of waterlogging.'),
  c('rice', 'Rice (paddy)', 'Oryza sativa', 'cereal', [900, 1500], 'very-high', [5.5, 6.8, 4.5, 8.2], [24, 34, 12, 42], 'C|SiCL|CL|SiC', [4, 5, 6], [9, 10], 140, 'low', 'moderate', 'low', 'Flooded paddy system. Requires heavy soils with a plough pan to hold standing water.'),
  c('sorghum', 'Sorghum', 'Sorghum bicolor', 'cereal', [350, 550], 'low', [6, 7.8, 5.2, 8.6], [25, 34, 12, 42], 'CL|L|SCL|SL', [4, 5, 6], [9, 10], 120, 'high', 'high', 'moderate', 'Heat- and drought-hardy warm-season cereal for semi-arid rotations.'),
  c('pearl-millet', 'Pearl millet', 'Pennisetum glaucum', 'cereal', [250, 420], 'very-low', [5.5, 7.5, 5, 8.4], [26, 36, 14, 45], 'LS|SL|S|L', [5, 6, 7], [9, 10], 95, 'high', 'high', 'high', 'Lowest-water cereal. Tolerates sandy, infertile soils and extreme heat.'),
  c('oats', 'Oats', 'Avena sativa', 'cereal', [400, 550], 'low', [5.5, 7, 5, 8], [12, 22, -8, 32], 'L|CL|SiL|SL', [10, 11, 0, 2], [4, 5, 6], 130, 'moderate', 'moderate', 'moderate', 'Cool-climate cereal used for grain and fodder; tolerates acidic soils.'),
  c('rye', 'Rye', 'Secale cereale', 'cereal', [350, 500], 'low', [5.5, 7, 4.8, 8], [10, 20, -25, 30], 'SL|LS|L|S', [9, 10, 11], [5, 6], 165, 'high', 'high', 'high', 'The most cold-hardy cereal; performs on sandy, low-fertility soils and fixes little nitrogen but breaks disease cycles.'),
  c('triticale', 'Triticale', 'x Triticosecale', 'cereal', [380, 550], 'low', [5.8, 7.5, 5, 8.4], [13, 24, -12, 33], 'L|SL|CL|SCL', [10, 11, 0], [4, 5], 155, 'high', 'high', 'moderate', 'Wheat–rye hybrid combining wheat quality with rye hardiness.'),
  c('teff', 'Teff', 'Eragrostis tef', 'cereal', [400, 600], 'moderate', [5.5, 7.2, 5, 8], [18, 28, 8, 38], 'L|CL|SL|SCL', [6, 7, 8], [10, 11], 105, 'moderate', 'low', 'moderate', 'Fine-grained warm-season cereal; lodging risk demands balanced nitrogen.'),
  c('buckwheat', 'Buckwheat', 'Fagopyrum esculentum', 'cereal', [350, 500], 'low', [5.5, 7, 5, 7.8], [16, 26, 5, 35], 'SL|LS|L|S', [5, 6, 7], [8, 9], 85, 'moderate', 'low', 'high', 'Short-cycle pseudo-cereal useful as a catch crop and pollinator support.'),

  // ----------------------------------------------------------------- pulses
  c('chickpea', 'Chickpea', 'Cicer arietinum', 'pulse', [300, 450], 'low', [6.5, 8.5, 6, 9], [18, 28, 2, 38], 'CL|SCL|L|C', [10, 11, 0], [3, 4], 120, 'high', 'moderate', 'moderate', 'Nitrogen-fixing winter pulse. Sensitive to excess moisture during flowering.'),
  c('lentil', 'Lentil', 'Lens culinaris', 'pulse', [280, 420], 'low', [6.5, 8.2, 6, 8.8], [16, 26, 0, 35], 'CL|L|SiL|SCL', [10, 11, 0], [3, 4], 120, 'high', 'moderate', 'moderate', 'Cool-season pulse that fixes nitrogen and fits dryland rotations.'),
  c('faba-bean', 'Faba bean', 'Vicia faba', 'pulse', [350, 500], 'low', [6.5, 8, 6, 8.5], [15, 25, -2, 32], 'CL|L|SiCL|C', [9, 10, 11], [4, 5], 145, 'low', 'moderate', 'moderate', 'High-biomass nitrogen fixer; intolerant of drought during pod fill.'),
  c('field-pea', 'Field pea', 'Pisum sativum', 'pulse', [320, 460], 'low', [6.5, 7.8, 6, 8.4], [14, 24, -2, 32], 'L|CL|SiL|SCL', [9, 10, 11], [4, 5], 110, 'low', 'low', 'moderate', 'Cool-season pulse for grain or forage; good rotational nitrogen contribution.'),
  c('common-bean', 'Common bean', 'Phaseolus vulgaris', 'pulse', [400, 550], 'moderate', [6, 7.5, 5.5, 8.2], [18, 27, 8, 35], 'L|SL|SiL|SCL', [4, 5, 6, 7], [8, 9], 95, 'low', 'low', 'high', 'Warm-season pulse. Sensitive to waterlogging, salinity and cold soils.'),
  c('cowpea', 'Cowpea', 'Vigna unguiculata', 'pulse', [300, 450], 'low', [5.8, 7.5, 5, 8.5], [24, 34, 12, 42], 'SL|LS|L|S', [5, 6, 7], [8, 9, 10], 90, 'high', 'moderate', 'high', 'Heat- and drought-tolerant pulse for sandy soils and short rainy seasons.'),
  c('pigeon-pea', 'Pigeon pea', 'Cajanus cajan', 'pulse', [350, 600], 'moderate', [5.5, 7.5, 5, 8.5], [24, 34, 12, 42], 'CL|L|SCL|SL', [5, 6], [11, 0, 1], 180, 'high', 'moderate', 'moderate', 'Deep-rooted perennial pulse; drought-hardy with a long season.'),
  c('mung-bean', 'Mung bean', 'Vigna radiata', 'pulse', [350, 480], 'low', [6, 7.5, 5.5, 8.2], [25, 35, 14, 42], 'L|SL|SCL|LS', [5, 6, 7], [8, 9], 80, 'moderate', 'low', 'high', 'Fast summer pulse; excellent nitrogen contribution in short windows.'),
  c('grass-pea', 'Grass pea', 'Lathyrus sativus', 'pulse', [280, 400], 'very-low', [6, 8, 5.5, 8.8], [16, 26, 0, 36], 'CL|C|L|SCL', [10, 11, 0], [3, 4], 130, 'high', 'high', 'low', 'The most drought-hardy pulse; tolerates heavy clay and salinity.'),

  // --------------------------------------------------------------- oilseeds
  c('soybean', 'Soybean', 'Glycine max', 'oilseed', [450, 700], 'moderate', [6, 7, 5.5, 7.8], [20, 30, 10, 38], 'L|SiL|CL|SCL', [4, 5, 6], [9, 10], 125, 'moderate', 'low', 'high', 'Dual-purpose oilseed and protein crop with strong nitrogen fixation.'),
  c('groundnut', 'Groundnut', 'Arachis hypogaea', 'oilseed', [500, 700], 'high', [6, 7.5, 5.5, 8.2], [24, 33, 14, 40], 'SL|LS|L|S', [4, 5, 6], [9, 10], 130, 'moderate', 'low', 'high', 'Requires loose, well-drained sandy soil for pod development and lifting.'),
  c('sunflower', 'Sunflower', 'Helianthus annuus', 'oilseed', [400, 650], 'moderate', [6, 7.8, 5.5, 8.5], [20, 30, 8, 40], 'CL|L|SCL|SiL', [2, 3, 4, 6, 7], [7, 8, 9, 10], 105, 'high', 'moderate', 'moderate', 'Deep-rooted oilseed with broad adaptability and multiple planting windows.'),
  c('rapeseed', 'Rapeseed / canola', 'Brassica napus', 'oilseed', [400, 550], 'low', [6, 7.5, 5.5, 8.2], [15, 25, -5, 32], 'CL|L|SiL|SCL', [9, 10, 11], [4, 5], 170, 'moderate', 'moderate', 'moderate', 'Cool-season oilseed; heavy nitrogen demand and a strong break-crop benefit.'),
  c('sesame', 'Sesame', 'Sesamum indicum', 'oilseed', [350, 550], 'low', [6, 8, 5.5, 8.5], [26, 36, 16, 44], 'SL|L|LS|SCL', [5, 6, 7], [9, 10], 100, 'high', 'moderate', 'high', 'Heat-loving oilseed; very sensitive to waterlogging and harvest shatter.'),
  c('linseed', 'Linseed / flax', 'Linum usitatissimum', 'oilseed', [350, 500], 'low', [6, 7.5, 5.5, 8], [15, 25, 2, 34], 'CL|L|SiCL|SCL', [10, 11, 0], [4, 5], 115, 'moderate', 'low', 'moderate', 'Dual-purpose fibre and oil crop for cool, moist seasons.'),
  c('safflower', 'Safflower', 'Carthamus tinctorius', 'oilseed', [300, 500], 'low', [6.5, 8.5, 6, 9], [20, 30, 5, 40], 'CL|C|SCL|L', [10, 11, 0], [4, 5], 130, 'high', 'high', 'moderate', 'Deep taproot makes it tolerant of drought and mildly saline soils.'),
  c('mustard', 'Mustard', 'Brassica juncea', 'oilseed', [320, 450], 'low', [6, 7.8, 5.5, 8.5], [15, 26, 0, 34], 'L|CL|SL|SCL', [9, 10, 11], [3, 4], 115, 'moderate', 'moderate', 'moderate', 'Short-season cool oilseed widely used in dryland rotations.'),
  c('castor', 'Castor', 'Ricinus communis', 'oilseed', [450, 700], 'moderate', [6, 7.8, 5.5, 8.5], [24, 34, 12, 42], 'SCL|CL|L|SL', [3, 4, 6, 7], [10, 11, 0], 170, 'high', 'moderate', 'moderate', 'Industrial oilseed with high drought tolerance; needs heat and good drainage.'),

  // ------------------------------------------------------------------ fibre
  c('cotton', 'Cotton', 'Gossypium hirsutum', 'fibre', [600, 900], 'high', [6, 7.8, 5.5, 8.6], [25, 35, 15, 43], 'CL|SCL|C|L', [4, 5, 6], [10, 11], 180, 'moderate', 'moderate', 'moderate', 'Long-season fibre crop with high heat requirement and moderate water demand.'),
  c('jute', 'Jute', 'Corchorus olitorius', 'fibre', [700, 1000], 'high', [6, 7.5, 5.5, 8.2], [26, 36, 18, 42], 'CL|L|SiCL|SCL', [4, 5, 6], [8, 9], 120, 'low', 'low', 'low', 'Humid-tropical fibre crop requiring high rainfall and warm conditions.'),
  c('kenaf', 'Kenaf', 'Hibiscus cannabinus', 'fibre', [550, 800], 'high', [6, 7.5, 5.5, 8.4], [24, 34, 14, 42], 'L|SL|SCL|CL', [4, 5, 6], [9, 10], 130, 'moderate', 'moderate', 'moderate', 'Fast-growing fibre crop with a shorter cycle than jute.'),

  // ----------------------------------------------------------- roots & tubers
  c('potato', 'Potato', 'Solanum tuberosum', 'root', [500, 700], 'moderate', [5.2, 6.5, 4.8, 7.5], [15, 22, -2, 32], 'SL|L|LS|SiL', [2, 3, 4, 8, 9, 10], [6, 7, 11, 0], 100, 'low', 'low', 'high', 'Tuber crop requiring loose soil and steady moisture; intolerant of waterlogging.'),
  c('sweet-potato', 'Sweet potato', 'Ipomoea batatas', 'root', [450, 700], 'moderate', [5.5, 6.8, 5, 7.6], [22, 32, 12, 40], 'SL|LS|L|S', [4, 5, 6], [9, 10], 120, 'moderate', 'low', 'high', 'Warm-season tuber with good drought tolerance and low input demand.'),
  c('cassava', 'Cassava', 'Manihot esculenta', 'root', [500, 900], 'high', [5.5, 7, 5, 8], [25, 34, 16, 42], 'SL|LS|L|S', [3, 4, 5, 6], [12, 1, 2], 300, 'high', 'low', 'high', 'Perennial root crop for tropical sandy soils; tolerates acidity and low fertility.'),
  c('sugar-beet', 'Sugar beet', 'Beta vulgaris', 'root', [550, 750], 'high', [6.5, 7.8, 6, 8.4], [15, 25, -2, 34], 'CL|L|SiCL|SCL', [2, 3, 8, 9], [8, 9, 10], 190, 'low', 'moderate', 'moderate', 'Deep-rooted sugar crop with high water and boron demand.'),
  c('radish', 'Radish', 'Raphanus sativus', 'root', [300, 420], 'low', [6, 7.2, 5.5, 7.8], [12, 22, 2, 30], 'SL|L|LS|SiL', [2, 3, 8, 9, 10], [5, 6, 11], 35, 'low', 'low', 'high', 'Fast cool-season root crop, useful as a short catch crop.'),

  // ------------------------------------------------------------- vegetables
  c('tomato', 'Tomato', 'Solanum lycopersicum', 'vegetable', [500, 750], 'high', [6, 7, 5.5, 7.8], [20, 28, 8, 36], 'L|SL|CL|SCL', [2, 3, 4, 7, 8], [6, 7, 10, 11], 110, 'low', 'moderate', 'high', 'High-value fruiting vegetable; sensitive to frost, salinity and moisture swings.'),
  c('onion', 'Onion', 'Allium cepa', 'vegetable', [400, 600], 'moderate', [6, 7.2, 5.5, 7.8], [15, 25, 2, 34], 'SL|L|SiL|LS', [9, 10, 11, 1, 2], [4, 5, 6], 150, 'low', 'moderate', 'high', 'Bulb crop with shallow roots; needs frequent light irrigation and loose soil.'),
  c('garlic', 'Garlic', 'Allium sativum', 'vegetable', [350, 500], 'low', [6, 7.2, 5.5, 7.8], [13, 24, -2, 32], 'L|SL|SiL|CL', [9, 10, 11], [4, 5], 220, 'low', 'moderate', 'high', 'Cool-season bulb crop with a long cycle and low water demand.'),
  c('chilli-pepper', 'Chilli pepper', 'Capsicum annuum', 'vegetable', [450, 650], 'moderate', [6, 7.2, 5.5, 7.8], [22, 30, 12, 38], 'L|SL|SCL|CL', [2, 3, 4, 7], [7, 8, 11], 120, 'low', 'low', 'high', 'Warm-season spice vegetable; very sensitive to waterlogging and salinity.'),
  c('eggplant', 'Eggplant', 'Solanum melongena', 'vegetable', [450, 650], 'moderate', [6, 7.2, 5.5, 7.8], [22, 32, 12, 40], 'L|SL|SCL|CL', [3, 4, 5, 7], [8, 9, 10], 120, 'low', 'moderate', 'high', 'Heat-loving fruiting vegetable with a long harvest window.'),
  c('okra', 'Okra', 'Abelmoschus esculentus', 'vegetable', [400, 600], 'moderate', [6, 7.5, 5.5, 8], [24, 34, 14, 42], 'L|SL|SCL|CL', [4, 5, 6], [8, 9, 10], 95, 'moderate', 'moderate', 'moderate', 'Warm-season vegetable that tolerates heat and moderate salinity.'),
  c('cabbage', 'Cabbage', 'Brassica oleracea', 'vegetable', [400, 550], 'low', [6, 7.2, 5.5, 7.8], [14, 24, -3, 32], 'CL|L|SiL|SCL', [2, 3, 7, 8, 9], [6, 7, 11, 0], 100, 'low', 'low', 'moderate', 'Cool-season brassica with steady moisture and nitrogen demand.'),
  c('cauliflower', 'Cauliflower', 'Brassica oleracea var. botrytis', 'vegetable', [400, 550], 'low', [6, 7.2, 5.5, 7.8], [14, 22, -2, 30], 'CL|L|SiL|SCL', [2, 3, 7, 8, 9], [6, 7, 11, 0], 95, 'low', 'low', 'moderate', 'Cool-season brassica sensitive to heat and boron deficiency.'),
  c('carrot', 'Carrot', 'Daucus carota', 'vegetable', [350, 500], 'low', [6, 7, 5.5, 7.8], [14, 22, -2, 32], 'SL|LS|L|SiL', [2, 3, 8, 9], [6, 7, 11, 0], 90, 'low', 'low', 'high', 'Root vegetable needing deep, stone-free soil for straight roots.'),
  c('cucumber', 'Cucumber', 'Cucumis sativus', 'vegetable', [400, 600], 'moderate', [6, 7, 5.5, 7.6], [20, 30, 10, 38], 'SL|L|SCL|LS', [3, 4, 5, 7], [7, 8, 9], 75, 'low', 'low', 'high', 'Warm-season vine crop with a short cycle and high irrigation frequency.'),

  // ----------------------------------------------------------------- fruits
  c('mango', 'Mango', 'Mangifera indica', 'tree', [700, 1100], 'very-high', [5.5, 7.5, 5, 8.2], [24, 34, 10, 45], 'L|SL|SCL|CL', [2, 3, 7, 8], [5, 6, 10, 11], 1500, 'high', 'low', 'high', 'Perennial tropical fruit tree. Deep soil and a dry spell before flowering improve fruit set.'),
  c('banana', 'Banana', 'Musa acuminata', 'tree', [1200, 1800], 'very-high', [6, 7.5, 5.5, 8], [26, 34, 15, 42], 'L|CL|SiCL|SCL', [2, 3, 8, 9], [12, 1, 2, 3], 330, 'low', 'low', 'moderate', 'Very high water demand. Requires deep, fertile, well-drained soil and wind protection.'),
  c('citrus-orange', 'Citrus (orange)', 'Citrus sinensis', 'tree', [700, 1000], 'very-high', [6, 7.5, 5.5, 8], [22, 32, 5, 40], 'SL|L|SCL|LS', [1, 2, 3, 8, 9], [11, 12, 0, 1], 1095, 'moderate', 'low', 'high', 'Perennial evergreen fruit tree. Sensitive to waterlogging and hard frost.'),
  c('apple', 'Apple', 'Malus domestica', 'tree', [600, 850], 'high', [6, 7, 5.5, 7.8], [15, 24, -25, 32], 'L|CL|SiL|SCL', [1, 2, 11], [8, 9, 10], 1825, 'low', 'low', 'moderate', 'Temperate fruit tree requiring winter chill hours to break dormancy.'),
  c('grape', 'Grape', 'Vitis vinifera', 'tree', [450, 700], 'moderate', [6, 7.5, 5.5, 8.2], [20, 30, -12, 40], 'CL|SCL|L|SL', [1, 2, 3], [8, 9, 10], 1095, 'high', 'moderate', 'high', 'Deep-rooted perennial vine. Moderate water stress during ripening improves fruit quality.'),
  c('date-palm', 'Date palm', 'Phoenix dactylifera', 'tree', [900, 1500], 'very-high', [6.5, 8.5, 6, 9], [28, 40, 8, 50], 'SL|L|SCL|S', [2, 3, 4], [9, 10, 11], 1825, 'high', 'high', 'high', 'Extreme heat and salinity tolerance. Requires deep irrigation in arid environments.'),
  c('pomegranate', 'Pomegranate', 'Punica granatum', 'tree', [400, 650], 'moderate', [6, 7.8, 5.5, 8.4], [22, 34, 5, 42], 'CL|L|SCL|C', [1, 2, 3], [8, 9, 10], 1095, 'high', 'moderate', 'moderate', 'Drought-hardy fruit tree that performs well in semi-arid climates.'),
  c('guava', 'Guava', 'Psidium guajava', 'tree', [600, 900], 'high', [5.5, 7.5, 5, 8.2], [23, 34, 10, 42], 'L|SL|SCL|CL', [2, 3, 7, 8], [10, 11, 12, 1], 730, 'high', 'moderate', 'moderate', 'Vigorous tropical fruit tree with wide soil adaptability.'),
  c('papaya', 'Papaya', 'Carica papaya', 'tree', [800, 1200], 'very-high', [6, 7, 5.5, 7.8], [25, 34, 15, 42], 'L|SL|SCL|LS', [2, 3, 8, 9], [11, 12, 1, 2], 300, 'low', 'low', 'high', 'Fast-growing tropical fruit; extremely sensitive to waterlogging and wind.'),
  c('olive', 'Olive', 'Olea europaea', 'tree', [350, 600], 'moderate', [6.5, 8.5, 6, 9], [20, 32, -8, 42], 'CL|L|SCL|C', [2, 3, 9, 10], [10, 11, 12], 1825, 'high', 'high', 'high', 'Mediterranean fruit tree with excellent drought and salinity tolerance.'),
  c('fig', 'Fig', 'Ficus carica', 'tree', [400, 650], 'moderate', [6.5, 8, 6, 8.6], [22, 34, -8, 42], 'CL|L|SCL|C', [1, 2, 3], [8, 9, 10], 1460, 'high', 'moderate', 'moderate', 'Hardy fruit tree for dry climates; tolerates shallow and calcareous soils.'),
  c('strawberry', 'Strawberry', 'Fragaria x ananassa', 'fruit', [450, 600], 'moderate', [5.5, 6.8, 5, 7.5], [14, 24, -6, 32], 'SL|L|LS|SiL', [8, 9, 10], [11, 12, 1, 2], 120, 'low', 'low', 'high', 'High-value berry requiring precise irrigation and free-draining soil.'),

  // ------------------------------------------------------------- tree nuts
  c('almond', 'Almond', 'Prunus dulcis', 'tree', [500, 800], 'high', [6.5, 8.2, 6, 8.8], [18, 30, -10, 40], 'CL|L|SCL|C', [1, 2, 11], [7, 8], 1825, 'high', 'moderate', 'high', 'Early-flowering nut tree; frost during bloom is the main yield risk.'),
  c('walnut', 'Walnut', 'Juglans regia', 'tree', [650, 950], 'high', [6, 7.5, 5.5, 8], [16, 28, -20, 38], 'L|CL|SiL|SCL', [1, 2, 11], [8, 9, 10], 2190, 'low', 'low', 'high', 'Deep-rooted temperate nut tree; requires well-drained soil and good air drainage.'),
  c('pistachio', 'Pistachio', 'Pistacia vera', 'tree', [400, 700], 'moderate', [6.5, 8.5, 6, 9], [22, 36, -10, 45], 'SL|SCL|L|LS', [2, 3], [8, 9], 2190, 'high', 'high', 'high', 'Very drought- and salt-tolerant nut tree suited to arid, calcareous soils.'),
  c('hazelnut', 'Hazelnut', 'Corylus avellana', 'tree', [600, 850], 'high', [5.5, 7.5, 5, 8], [15, 26, -18, 35], 'L|CL|SiL|SCL', [1, 2, 11], [8, 9], 1825, 'low', 'low', 'moderate', 'Temperate nut shrub; prefers humid air and deep, fertile loam.'),

  // ----------------------------------------------------------------- fodder
  c('alfalfa', 'Alfalfa', 'Medicago sativa', 'fodder', [700, 1100], 'very-high', [6.5, 8, 6, 8.8], [18, 30, -12, 40], 'L|CL|SiL|SCL', [2, 3, 8, 9], [5, 6, 7, 10, 11], 730, 'high', 'moderate', 'high', 'Deep-rooted perennial forage legume with high yield and nitrogen fixation.'),
  c('berseem-clover', 'Berseem clover', 'Trifolium alexandrinum', 'fodder', [500, 800], 'high', [6.5, 8, 6, 8.6], [16, 26, 0, 34], 'CL|C|L|SCL', [9, 10, 11], [2, 3, 4, 5], 180, 'low', 'moderate', 'low', 'Winter forage legume with multiple cuts and high nitrogen contribution.'),
  c('sorghum-sudan', 'Sorghum-sudan grass', 'Sorghum x drummondii', 'fodder', [350, 600], 'moderate', [6, 7.8, 5.5, 8.5], [24, 34, 12, 42], 'L|SL|SCL|CL', [4, 5, 6, 7], [8, 9, 10], 110, 'high', 'moderate', 'moderate', 'Fast summer forage with high biomass under heat and limited water.'),
  c('rhodes-grass', 'Rhodes grass', 'Chloris gayana', 'fodder', [400, 700], 'moderate', [6, 8, 5.5, 8.6], [22, 34, 8, 42], 'SL|LS|L|SCL', [3, 4, 5], [9, 10, 11], 300, 'high', 'moderate', 'high', 'Perennial warm-season pasture grass for sandy soils and rotational grazing.'),
];

export const CROP_DATASET_META = {
  id: 'agrisense-crop-dataset',
  version: 'demo-1.0.0',
  size: CROP_PROFILES.length,
  isDemonstration: true,
  label: 'Demonstration crop profile dataset',
} as const;

export const WATER_CLASS_LABELS: Record<WaterClass, string> = {
  'very-low': 'Very low',
  low: 'Low',
  moderate: 'Moderate',
  high: 'High',
  'very-high': 'Very high',
};
