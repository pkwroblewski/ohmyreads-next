/**
 * Geohash encoding/decoding utilities
 * 
 * Geohash is a hierarchical spatial data structure that subdivides space
 * into buckets of grid shape. It's useful for approximate location storage
 * because truncating the hash reduces precision predictably.
 * 
 * Precision guide:
 * - 1 char: ±2500 km
 * - 2 chars: ±630 km
 * - 3 chars: ±78 km
 * - 4 chars: ±20 km
 * - 5 chars: ±2.4 km
 * - 6 chars: ±0.61 km (~1.2 km cell)
 * - 7 chars: ±0.076 km
 * - 8 chars: ±0.019 km
 */

const BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz";

/**
 * Encode latitude/longitude to a geohash string
 */
export function encodeGeohash(lat: number, lng: number, precision: number = 6): string {
  let latMin = -90, latMax = 90;
  let lngMin = -180, lngMax = 180;
  let hash = "";
  let bit = 0;
  let ch = 0;
  let isLng = true;

  while (hash.length < precision) {
    if (isLng) {
      const mid = (lngMin + lngMax) / 2;
      if (lng >= mid) {
        ch |= 1 << (4 - bit);
        lngMin = mid;
      } else {
        lngMax = mid;
      }
    } else {
      const mid = (latMin + latMax) / 2;
      if (lat >= mid) {
        ch |= 1 << (4 - bit);
        latMin = mid;
      } else {
        latMax = mid;
      }
    }

    isLng = !isLng;
    bit++;

    if (bit === 5) {
      hash += BASE32[ch];
      bit = 0;
      ch = 0;
    }
  }

  return hash;
}

/**
 * Decode a geohash to approximate center coordinates
 */
export function decodeGeohash(hash: string): { lat: number; lng: number; latErr: number; lngErr: number } {
  let latMin = -90, latMax = 90;
  let lngMin = -180, lngMax = 180;
  let isLng = true;

  for (const char of hash.toLowerCase()) {
    const idx = BASE32.indexOf(char);
    if (idx === -1) continue;

    for (let bit = 4; bit >= 0; bit--) {
      const bitVal = (idx >> bit) & 1;
      if (isLng) {
        const mid = (lngMin + lngMax) / 2;
        if (bitVal) {
          lngMin = mid;
        } else {
          lngMax = mid;
        }
      } else {
        const mid = (latMin + latMax) / 2;
        if (bitVal) {
          latMin = mid;
        } else {
          latMax = mid;
        }
      }
      isLng = !isLng;
    }
  }

  return {
    lat: (latMin + latMax) / 2,
    lng: (lngMin + lngMax) / 2,
    latErr: (latMax - latMin) / 2,
    lngErr: (lngMax - lngMin) / 2,
  };
}

/**
 * Get neighboring geohashes (for searching nearby areas)
 */
export function getNeighbors(hash: string): string[] {
  const { lat, lng, latErr, lngErr } = decodeGeohash(hash);
  const precision = hash.length;
  
  const neighbors: string[] = [];
  const step = 2; // Check 2 steps in each direction
  
  for (let dLat = -step; dLat <= step; dLat++) {
    for (let dLng = -step; dLng <= step; dLng++) {
      const newLat = lat + dLat * latErr * 2;
      const newLng = lng + dLng * lngErr * 2;
      
      // Skip if out of bounds
      if (newLat < -90 || newLat > 90 || newLng < -180 || newLng > 180) continue;
      
      const neighborHash = encodeGeohash(newLat, newLng, precision);
      if (!neighbors.includes(neighborHash)) {
        neighbors.push(neighborHash);
      }
    }
  }
  
  return neighbors;
}

/**
 * Get the geohash prefix for a given precision
 * Lower precision = larger area = more privacy
 */
export function getGeohashPrefix(hash: string, precision: number): string {
  return hash.slice(0, Math.min(precision, hash.length));
}

/**
 * Convert precision level to approximate distance
 */
export function precisionToDistance(precision: number): string {
  const distances: Record<number, string> = {
    1: "~2500 km",
    2: "~630 km",
    3: "~78 km",
    4: "~20 km",
    5: "~2.4 km",
    6: "~1.2 km",
    7: "~150 m",
    8: "~40 m",
  };
  return distances[precision] || "unknown";
}

/**
 * Validate a geohash string
 */
export function isValidGeohash(hash: string): boolean {
  if (!hash || typeof hash !== "string") return false;
  return /^[0-9bcdefghjkmnpqrstuvwxyz]+$/i.test(hash);
}

