import { setMapCacheStatus } from './offlineDB.js';
import bimstecBounds from '../data/bimstec_bounds.json';

const OSM_TILE_URL = 'https://a.tile.openstreetmap.org';
const MAX_TILES = 200;
const ZOOM_LEVELS = [10, 11, 12, 13];

/**
 * Convert lat/lng to tile coordinates at a given zoom level
 */
function latLngToTile(lat, lng, zoom) {
  const n = Math.pow(2, zoom);
  const x = Math.floor(((lng + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n);
  return { x, y, z: zoom };
}

/**
 * Generate all tile coordinates for a bounding box at a zoom level
 */
function tilesForBounds(minLat, maxLat, minLng, maxLng, zoom) {
  const topLeft = latLngToTile(maxLat, minLng, zoom);
  const bottomRight = latLngToTile(minLat, maxLng, zoom);
  const tiles = [];
  for (let x = topLeft.x; x <= bottomRight.x; x++) {
    for (let y = topLeft.y; y <= bottomRight.y; y++) {
      tiles.push({ x, y, z: zoom });
    }
  }
  return tiles;
}

/**
 * Pre-warm tiles for a country bounding box
 */
export async function prewarmTiles(bounds, onProgress) {
  if (!bounds) return;

  const { min_lat, max_lat, min_lng, max_lng } = bounds;

  let allTiles = [];
  for (const zoom of ZOOM_LEVELS) {
    const tiles = tilesForBounds(min_lat, max_lat, min_lng, max_lng, zoom);
    allTiles.push(...tiles);
    if (allTiles.length >= MAX_TILES) break;
  }

  if (allTiles.length > MAX_TILES) {
    const step = Math.floor(allTiles.length / MAX_TILES);
    allTiles = allTiles.filter((_, i) => i % step === 0).slice(0, MAX_TILES);
  }

  const total = allTiles.length;
  let fetched = 0;

  console.info(`[TilePrewarm] Fetching ${total} tiles for bounds...`);
  await fetchTileBatch(allTiles, (f) => onProgress && onProgress(f, total));
  await setMapCacheStatus(true);
}

/**
 * Pre-warm local area map tiles (3x3 grid around user's exact coordinates at zooms 11-15)
 */
export async function prewarmLocalArea(lat, lng, onProgress) {
  console.info(`[TilePrewarm] Pre-warming local map tiles around user location: ${lat}, ${lng}...`);
  const localZoomLevels = [11, 12, 13, 14, 15];
  const allTiles = [];

  for (const zoom of localZoomLevels) {
    const centerTile = latLngToTile(lat, lng, zoom);
    // 3x3 grid centered on user
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        allTiles.push({
          x: centerTile.x + dx,
          y: centerTile.y + dy,
          z: zoom
        });
      }
    }
  }

  const total = allTiles.length;
  await fetchTileBatch(allTiles, (f) => onProgress && onProgress(f, total));
  await setMapCacheStatus(true);
}

/**
 * Pre-warm map tiles for all BIMSTEC countries at once
 */
export async function prewarmAllCountries(onProgress) {
  console.info('[TilePrewarm] Preparing to pre-warm tiles for all BIMSTEC countries...');
  let combinedTiles = [];

  for (const b of bimstecBounds) {
    let countryTiles = [];
    for (const zoom of ZOOM_LEVELS) {
      const tiles = tilesForBounds(b.min_lat, b.max_lat, b.min_lng, b.max_lng, zoom);
      countryTiles.push(...tiles);
      if (countryTiles.length >= MAX_TILES) break;
    }
    // Cap each country to preserve memory
    if (countryTiles.length > MAX_TILES) {
      const step = Math.floor(countryTiles.length / MAX_TILES);
      countryTiles = countryTiles.filter((_, i) => i % step === 0).slice(0, MAX_TILES);
    }
    combinedTiles.push(...countryTiles);
  }

  const total = combinedTiles.length;
  console.info(`[TilePrewarm] Fetching total ${total} tiles for all BIMSTEC countries...`);
  await fetchTileBatch(combinedTiles, (f) => onProgress && onProgress(f, total));
  await setMapCacheStatus(true);
}

/**
 * Helper to fetch a batch of tiles safely
 */
async function fetchTileBatch(tiles, onStep) {
  const BATCH_SIZE = 5;
  let fetched = 0;

  for (let i = 0; i < tiles.length; i += BATCH_SIZE) {
    const batch = tiles.slice(i, i + BATCH_SIZE);
    await Promise.allSettled(
      batch.map(async ({ x, y, z }) => {
        const url = `${OSM_TILE_URL}/${z}/${x}/${y}.png`;
        try {
          await fetch(url, { mode: 'no-cors' });
        } catch {}
        fetched++;
        onStep && onStep(fetched);
      })
    );
    await new Promise((r) => setTimeout(r, 40));
  }
}

export default { prewarmTiles, prewarmLocalArea, prewarmAllCountries };
