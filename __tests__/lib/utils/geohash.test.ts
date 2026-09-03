/**
 * Tests for geohash encoding and the privacy properties the reader map relies
 * on (Task 28).
 *
 * The map never stores an exact coordinate: it stores a geohash and publishes a
 * truncated prefix. That only protects anyone if truncation genuinely destroys
 * precision and is genuinely irreversible, so most of what follows checks the
 * *loss* rather than the accuracy.
 */

import { describe, it, expect } from "vitest";
import {
  encodeGeohash,
  decodeGeohash,
  getNeighbors,
  getGeohashPrefix,
  precisionToDistance,
  isValidGeohash,
} from "@/lib/utils/geohash";

/** Metres per degree of latitude — good enough to bound a privacy cell. */
const M_PER_DEG_LAT = 111_320;

const PLACES = {
  london: { lat: 51.5074, lng: -0.1278 },
  sydney: { lat: -33.8688, lng: 151.2093 },
  quito: { lat: -0.1807, lng: -78.4678 },
  nullIsland: { lat: 0, lng: 0 },
};

describe("encodeGeohash", () => {
  it("produces the documented hash for known coordinates", () => {
    // Cross-checked against the standard geohash of central London.
    expect(encodeGeohash(PLACES.london.lat, PLACES.london.lng, 6)).toBe(
      "gcpvj0"
    );
  });

  it("honours the requested precision", () => {
    for (const precision of [1, 4, 6, 8, 12]) {
      expect(
        encodeGeohash(PLACES.sydney.lat, PLACES.sydney.lng, precision)
      ).toHaveLength(precision);
    }
  });

  it("emits only base32 geohash characters", () => {
    // a, i, l and o are deliberately absent from the alphabet.
    for (const { lat, lng } of Object.values(PLACES)) {
      expect(encodeGeohash(lat, lng, 9)).toMatch(
        /^[0123456789bcdefghjkmnpqrstuvwxyz]+$/
      );
    }
  });

  it("is prefix-consistent: a shorter hash is a prefix of a longer one", () => {
    const long = encodeGeohash(PLACES.quito.lat, PLACES.quito.lng, 9);

    for (let p = 1; p <= 9; p++) {
      expect(long.startsWith(encodeGeohash(PLACES.quito.lat, PLACES.quito.lng, p))).toBe(
        true
      );
    }
  });

  it("handles the poles and the antimeridian without escaping the alphabet", () => {
    for (const [lat, lng] of [
      [90, 180],
      [-90, -180],
      [90, -180],
      [-90, 180],
    ]) {
      expect(encodeGeohash(lat, lng, 8)).toMatch(/^[0-9b-hjkmnp-z]{8}$/);
    }
  });
});

describe("decodeGeohash", () => {
  it("round-trips a coordinate back to within the cell's own error", () => {
    for (const { lat, lng } of Object.values(PLACES)) {
      const decoded = decodeGeohash(encodeGeohash(lat, lng, 9));

      expect(Math.abs(decoded.lat - lat)).toBeLessThanOrEqual(decoded.latErr);
      expect(Math.abs(decoded.lng - lng)).toBeLessThanOrEqual(decoded.lngErr);
    }
  });

  it("reports a wider error for a shorter hash", () => {
    const full = encodeGeohash(PLACES.london.lat, PLACES.london.lng, 8);
    let previous = 0;

    for (let p = 8; p >= 1; p--) {
      const { latErr } = decodeGeohash(full.slice(0, p));
      expect(latErr).toBeGreaterThan(previous);
      previous = latErr;
    }
  });

  it("ignores characters outside the alphabet instead of throwing", () => {
    // The two junk characters contribute nothing: the result is the decode
    // of the remaining six valid characters.
    expect(decodeGeohash("gcpv!?j0")).toEqual(decodeGeohash("gcpvj0"));
    expect(decodeGeohash("GCPVJ0")).toEqual(decodeGeohash("gcpvj0"));
  });
});

describe("privacy: truncation actually destroys precision", () => {
  it("collapses two nearby readers onto the same published cell", () => {
    // Two points ~200 m apart. At precision 5 (~2.4 km) they must be
    // indistinguishable, or the map leaks which of them is which.
    const a = { lat: 51.5074, lng: -0.1278 };
    const b = { lat: 51.5074 + 200 / M_PER_DEG_LAT, lng: -0.1278 };

    expect(getGeohashPrefix(encodeGeohash(a.lat, a.lng, 9), 5)).toBe(
      getGeohashPrefix(encodeGeohash(b.lat, b.lng, 9), 5)
    );
  });

  it("keeps a published 5-character cell at least a kilometre across", () => {
    // Sampled over the whole globe rather than one city: the cell's latitude
    // span is constant, and this is the number that bounds how precisely a
    // published hash can locate someone.
    for (let lat = -80; lat <= 80; lat += 20) {
      for (let lng = -180; lng < 180; lng += 45) {
        const { latErr } = decodeGeohash(encodeGeohash(lat, lng, 5));
        const cellHeightMetres = latErr * 2 * M_PER_DEG_LAT;

        expect(cellHeightMetres).toBeGreaterThan(1_000);
      }
    }
  });

  it("cannot recover the original position from a truncated hash", () => {
    const exact = { lat: 51.50734, lng: -0.12776 };
    const published = getGeohashPrefix(encodeGeohash(exact.lat, exact.lng, 9), 5);
    const recovered = decodeGeohash(published);

    // The best an attacker gets is the cell centre, which is not the point.
    expect(recovered.lat).not.toBe(exact.lat);
    expect(recovered.lng).not.toBe(exact.lng);
    expect(recovered.latErr * 2 * M_PER_DEG_LAT).toBeGreaterThan(1_000);
  });

  it("never lengthens a hash when asked for more precision than it has", () => {
    const hash = encodeGeohash(PLACES.london.lat, PLACES.london.lng, 4);

    expect(getGeohashPrefix(hash, 9)).toBe(hash);
    expect(getGeohashPrefix(hash, 2)).toBe(hash.slice(0, 2));
    expect(getGeohashPrefix(hash, 0)).toBe("");
  });
});

describe("getNeighbors", () => {
  it("includes the cell itself and only same-length hashes", () => {
    const hash = encodeGeohash(PLACES.london.lat, PLACES.london.lng, 5);
    const neighbors = getNeighbors(hash);

    expect(neighbors).toContain(hash);
    expect(neighbors.every((n) => n.length === hash.length)).toBe(true);
  });

  it("returns no duplicates", () => {
    const neighbors = getNeighbors(
      encodeGeohash(PLACES.sydney.lat, PLACES.sydney.lng, 5)
    );

    expect(new Set(neighbors).size).toBe(neighbors.length);
  });

  it("stays inside the coordinate range near a pole", () => {
    const neighbors = getNeighbors(encodeGeohash(89.9, 0, 5));

    for (const n of neighbors) {
      const { lat, lng } = decodeGeohash(n);
      expect(lat).toBeGreaterThanOrEqual(-90);
      expect(lat).toBeLessThanOrEqual(90);
      expect(lng).toBeGreaterThanOrEqual(-180);
      expect(lng).toBeLessThanOrEqual(180);
    }
  });
});

describe("isValidGeohash", () => {
  it("accepts real hashes in either case", () => {
    expect(isValidGeohash("gcpvj0")).toBe(true);
    expect(isValidGeohash("GCPVJ0")).toBe(true);
  });

  it("rejects the four letters the alphabet omits", () => {
    for (const letter of ["a", "i", "l", "o"]) {
      expect(isValidGeohash(`gcpv${letter}0`)).toBe(false);
    }
  });

  it("rejects empty, non-string and structurally dangerous input", () => {
    expect(isValidGeohash("")).toBe(false);
    expect(isValidGeohash(null as unknown as string)).toBe(false);
    expect(isValidGeohash(undefined as unknown as string)).toBe(false);
    expect(isValidGeohash(123 as unknown as string)).toBe(false);

    // These are the characters that matter downstream: a geohash reaches
    // PostgREST filter strings, where `.` `,` `(` `)` and `%` are structural.
    for (const payload of [
      "gcpvj0,is.null",
      "gcpvj0.eq.x",
      "gcpvj0%",
      "gcpvj0)",
      "gcpvj0 or 1=1",
      "gcpvj0'",
    ]) {
      expect(isValidGeohash(payload)).toBe(false);
    }
  });
});

describe("precisionToDistance", () => {
  it("labels the precisions the app actually publishes", () => {
    expect(precisionToDistance(5)).toBe("~2.4 km");
    expect(precisionToDistance(6)).toBe("~1.2 km");
  });

  it("says so rather than guessing for an unmapped precision", () => {
    expect(precisionToDistance(0)).toBe("unknown");
    expect(precisionToDistance(12)).toBe("unknown");
  });
});
