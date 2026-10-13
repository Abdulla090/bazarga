/**
 * Dotted map for the "Any community" bento tile: Europe → Middle East, computed once on the server.
 * Rough coastline rings (lon, lat) are rasterised to a dot grid and emitted as ONE svg path of zero-length
 * round-capped segments ("M x y h0"), so ~700 dots cost a single DOM node and no client JS.
 * Projection: equirectangular with a cos(46°) x-squash, lon -11..50, lat 30..63 → viewBox 0 0 400 300.
 */
type Ring = readonly (readonly [number, number])[];

export const MAP_W = 400;
export const MAP_H = 300;
const LON0 = -11, LON1 = 50, LAT0 = 30, LAT1 = 63;

export function project(lon: number, lat: number): [number, number] {
  return [((lon - LON0) / (LON1 - LON0)) * MAP_W, ((LAT1 - lat) / (LAT1 - LAT0)) * MAP_H];
}

const MAINLAND: Ring = [
  [-9, 43.2], [-8.8, 37], [-5.6, 36], [-2, 36.7], [-0.3, 39.5], [0.9, 41], [3.2, 42], [3.2, 43.3], [4.8, 43.4], [6.5, 43.1],
  [7.7, 43.8], [8.8, 44.4], [10.2, 43.9], [11, 42.4], [12.5, 41.6], [14, 40.8], [15.6, 38], [16.6, 39], [17.2, 39.4],
  [18.5, 40.2], [16, 41.4], [14, 42.5], [12.4, 44.2], [13.6, 45.7], [14.5, 45.2], [15, 44.5], [17.5, 43], [19.4, 41.8],
  [20, 39.6], [21.5, 37.5], [22.5, 36.5], [23.5, 38], [22.9, 40.6], [24, 40.8], [26, 40.8], [26.2, 39.5], [27, 37],
  [28, 36.6], [30.5, 36.6], [32.5, 36.1], [36, 36.7], [35.9, 35], [35, 33], [34.4, 31.5], [34.9, 30], [50, 30], [50, 63],
  [21.8, 63], [21.2, 61], [22.9, 59.9], [30, 60.4], [28, 59.4], [23.5, 59.2], [21.5, 57.5], [21, 56], [21, 55], [19.6, 54.4],
  [14.2, 54], [11, 54], [10.5, 57.7], [8.6, 57.1], [8.1, 55.5], [8.6, 53.9], [5, 53.2], [3.5, 51.4], [1.6, 50.9],
  [-1.5, 49.7], [-4.7, 48.4], [-1.2, 46], [-1.8, 43.4],
];
const BLACK_SEA: Ring = [
  [28, 41.2], [29, 41.1], [33, 42], [36, 41.7], [38.5, 40.9], [41.5, 41.5], [41.6, 42.8], [39.5, 44.3], [37.5, 44.7],
  [38, 47], [35, 45.5], [33, 46], [30.7, 46.5], [29.7, 45.2], [28.6, 44], [28, 42.5],
];
const CASPIAN: Ring = [[49, 37.5], [50, 37.3], [50, 46.5], [49, 46.5], [47.3, 45], [47.5, 42.5], [49.5, 40.5], [49, 38.5]];
const AFRICA: Ring = [
  [-10, 30], [-9.8, 31.5], [-6.8, 34], [-5.9, 35.8], [-2, 35.1], [3, 36.8], [10, 37.3], [11, 36.8], [10.2, 34], [11.5, 33.1],
  [15, 32.4], [19, 30.3], [20, 31], [22, 32.8], [25, 31.8], [29, 31], [32.3, 31.2], [34.2, 31.3], [34.9, 30],
];
const SCANDINAVIA: Ring = [
  [5, 59], [5, 62], [7, 63], [17.5, 63], [17.2, 61], [18.8, 59.8], [16.5, 57], [16, 56.2], [14.2, 55.4], [12.8, 55.6],
  [11.8, 58], [10.5, 59.5], [8, 58.1], [6, 58.1],
];
const BRITAIN: Ring = [
  [-5.7, 50], [1.4, 51.2], [1.7, 52.7], [0, 53.5], [-1.5, 55], [-2, 57], [-1.8, 57.6], [-4, 58.6], [-5, 58.6], [-5.6, 56.5],
  [-4.8, 55], [-3, 54], [-3, 53.4], [-4.6, 53.3], [-4.2, 52.2], [-5.2, 51.7], [-3, 51.4],
];
const IRELAND: Ring = [[-6, 52.1], [-6, 54.1], [-5.5, 55.2], [-8, 55.2], [-10, 54], [-10, 51.6], [-8, 51.6]];

function inRing(lon: number, lat: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!, [xj, yj] = ring[j]!;
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function isLand(lon: number, lat: number): boolean {
  const main = inRing(lon, lat, MAINLAND) !== inRing(lon, lat, BLACK_SEA) !== inRing(lon, lat, CASPIAN);
  return main || inRing(lon, lat, AFRICA) || inRing(lon, lat, SCANDINAVIA) || inRing(lon, lat, BRITAIN) || inRing(lon, lat, IRELAND);
}

const STEP = 7;
/** One path for every land dot (stroke it with round caps; stroke-width = dot diameter). */
export const MAP_DOTS: string = (() => {
  const out: string[] = [];
  for (let y = STEP / 2; y < MAP_H; y += STEP) {
    for (let x = STEP / 2; x < MAP_W; x += STEP) {
      const lon = LON0 + (x / MAP_W) * (LON1 - LON0);
      const lat = LAT1 - (y / MAP_H) * (LAT1 - LAT0);
      if (isLand(lon, lat)) out.push(`M${x} ${y}h0`);
    }
  }
  return out.join("");
})();

export type MapCity = { key: string; lon: number; lat: number; hub?: boolean };
export const MAP_CITIES: MapCity[] = [
  { key: "erbil", lon: 44.01, lat: 36.19, hub: true },
  { key: "duhok", lon: 42.99, lat: 36.87 },
  { key: "sulaymaniyah", lon: 45.43, lat: 35.56 },
  { key: "berlin", lon: 13.4, lat: 52.52 },
  { key: "stockholm", lon: 18.07, lat: 59.33 },
  { key: "london", lon: -0.13, lat: 51.5 },
];

/** A gentle arc (quadratic, bowed towards the north) from the hub to a city, in viewBox units. */
export function arcPath(from: MapCity, to: MapCity): string {
  const [x1, y1] = project(from.lon, from.lat);
  const [x2, y2] = project(to.lon, to.lat);
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  const d = Math.hypot(x2 - x1, y2 - y1);
  return `M${x1.toFixed(1)} ${y1.toFixed(1)}Q${mx.toFixed(1)} ${(my - d * 0.28).toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`;
}
