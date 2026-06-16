// Seeded, deterministic pseudo-random generator (mulberry32) with helpers.
// Same seed + same prompt => same model, so results are reproducible.

export function hashStringToSeed(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}

export class RNG {
  constructor(seed = 1) {
    this.state = (seed >>> 0) || 1;
  }

  // float in [0,1)
  next() {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // float in [min,max)
  range(min, max) {
    return min + (max - min) * this.next();
  }

  // integer in [min,max] inclusive
  int(min, max) {
    return Math.floor(this.range(min, max + 1));
  }

  // true with probability p
  chance(p) {
    return this.next() < p;
  }

  // pick a random element
  pick(arr) {
    return arr[Math.floor(this.next() * arr.length)];
  }

  // signed jitter in [-amt,amt]
  jitter(amt) {
    return (this.next() * 2 - 1) * amt;
  }
}
