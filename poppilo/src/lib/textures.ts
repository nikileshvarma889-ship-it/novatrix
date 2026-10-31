import * as THREE from "three";
import { rand } from "./anim";

const cache = new Map<string, THREE.Texture>();

/** Soft fur-like noise for bump maps (generated once, deterministic). */
export function furTexture(): THREE.Texture {
  return cached("fur", () => {
    const n = 256;
    const data = new Uint8Array(n * n * 4);
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        // short strands: streaky noise mixed with fine grain
        const s = rand(Math.floor(x / 2) * 13.1 + Math.floor(y / 6) * 7.7);
        const g = rand(x * 3.3 + y * 91.7);
        const v = Math.floor((0.55 * s + 0.45 * g) * 255);
        const i = (y * n + x) * 4;
        data[i] = data[i + 1] = data[i + 2] = v;
        data[i + 3] = 255;
      }
    return data;
  }, 4);
}

/** Fabric weave for outfits. */
export function fabricTexture(): THREE.Texture {
  return cached("fabric", () => {
    const n = 128;
    const data = new Uint8Array(n * n * 4);
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        const weave = (Math.sin(x * 1.6) * Math.sin(y * 1.6) + 1) / 2;
        const v = Math.floor((0.7 * weave + 0.3 * rand(x * 7.1 + y * 3.7)) * 255);
        const i = (y * n + x) * 4;
        data[i] = data[i + 1] = data[i + 2] = v;
        data[i + 3] = 255;
      }
    return data;
  }, 6);
}

/** Grass blades noise for the ground. */
export function grassTexture(): THREE.Texture {
  return cached("grass", () => {
    const n = 256;
    const data = new Uint8Array(n * n * 4);
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        const v = Math.floor((0.6 * rand(Math.floor(x / 1) + Math.floor(y / 4) * 517) + 0.4 * rand(x * 0.37 + y * 11.3)) * 255);
        const i = (y * n + x) * 4;
        data[i] = data[i + 1] = data[i + 2] = v;
        data[i + 3] = 255;
      }
    return data;
  }, 40);
}

function cached(key: string, make: () => Uint8Array, repeat: number) {
  const hit = cache.get(key);
  if (hit) return hit;
  const data = make();
  const size = Math.sqrt(data.length / 4);
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  cache.set(key, tex);
  return tex;
}
