// Approximate coordinates for common places (city or country centroid).
const PLACES: Record<string, [number, number]> = {
  india: [21, 78], mumbai: [19.08, 72.88], delhi: [28.61, 77.21], "new delhi": [28.61, 77.21], bangalore: [12.97, 77.59], bengaluru: [12.97, 77.59],
  hyderabad: [17.39, 78.49], chennai: [13.08, 80.27], kolkata: [22.57, 88.36], pune: [18.52, 73.86], ahmedabad: [23.02, 72.57], kochi: [9.93, 76.27],
  usa: [39.8, -98.6], "united states": [39.8, -98.6], america: [39.8, -98.6], "new york": [40.71, -74.0], "los angeles": [34.05, -118.24], chicago: [41.88, -87.63],
  "san francisco": [37.77, -122.42], houston: [29.76, -95.37], texas: [31.0, -99.0], california: [36.8, -119.4], miami: [25.76, -80.19], seattle: [47.61, -122.33],
  canada: [56.1, -106.3], toronto: [43.65, -79.38], vancouver: [49.28, -123.12], mexico: [23.6, -102.5], "mexico city": [19.43, -99.13], brazil: [-14.2, -51.9],
  "são paulo": [-23.55, -46.63], "sao paulo": [-23.55, -46.63], uk: [54.0, -2.0], "united kingdom": [54.0, -2.0], london: [51.51, -0.13], france: [46.6, 2.2],
  paris: [48.86, 2.35], germany: [51.2, 10.4], berlin: [52.52, 13.4], spain: [40.4, -3.7], madrid: [40.42, -3.7], italy: [42.5, 12.5], rome: [41.9, 12.5],
  netherlands: [52.1, 5.3], amsterdam: [52.37, 4.9], turkey: [39.0, 35.2], istanbul: [41.01, 28.98], russia: [61.5, 105.3], moscow: [55.76, 37.62],
  uae: [23.4, 53.8], dubai: [25.2, 55.27], "abu dhabi": [24.45, 54.38], saudi: [23.9, 45.1], riyadh: [24.71, 46.68], qatar: [25.3, 51.2], doha: [25.29, 51.53],
  egypt: [26.8, 30.8], cairo: [30.04, 31.24], nigeria: [9.1, 8.7], lagos: [6.52, 3.38], kenya: [-0.02, 37.9], nairobi: [-1.29, 36.82], "south africa": [-30.6, 22.9],
  johannesburg: [-26.2, 28.05], pakistan: [30.4, 69.3], karachi: [24.86, 67.0], bangladesh: [23.7, 90.4], dhaka: [23.81, 90.41], nepal: [28.4, 84.1],
  "sri lanka": [7.9, 80.8], colombo: [6.93, 79.86], china: [35.9, 104.2], beijing: [39.9, 116.4], shanghai: [31.23, 121.47], "hong kong": [22.32, 114.17],
  japan: [36.2, 138.3], tokyo: [35.68, 139.69], korea: [36.5, 127.9], seoul: [37.57, 126.98], singapore: [1.35, 103.82], thailand: [15.9, 100.99],
  bangkok: [13.76, 100.5], malaysia: [4.2, 102.0], "kuala lumpur": [3.14, 101.69], indonesia: [-0.8, 113.9], jakarta: [-6.2, 106.85], philippines: [12.9, 121.8],
  manila: [14.6, 120.98], vietnam: [14.1, 108.3], australia: [-25.3, 133.8], sydney: [-33.87, 151.21], melbourne: [-37.81, 144.96], "new zealand": [-40.9, 174.9],
};

export function locate(place: string): [number, number] {
  const p = place.toLowerCase();
  const keys = Object.keys(PLACES).sort((a, b) => b.length - a.length);
  for (const k of keys) if (p.includes(k)) return PLACES[k];
  // Unknown place: a stable but arbitrary position (the label still names it).
  let h = 0;
  for (const c of p) h = (h * 31 + c.charCodeAt(0)) | 0;
  return [((h % 120) + 120) % 120 - 60, ((h >> 8) % 360 + 360) % 360 - 180];
}
