import React, { useMemo } from "react";
import * as THREE from "three";
import { NOISE } from "./noise";

/** Deep-space backdrop: black-blue void, Milky Way band with dust lanes and a warm core, faint blue nebula. */
export const SkyDome: React.FC<{ intensity?: number; band?: number }> = ({ intensity = 1, band = 1 }) => {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: { uIntensity: { value: intensity }, uBand: { value: band } },
        vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
        fragmentShader: `${NOISE}
          varying vec3 vDir; uniform float uIntensity; uniform float uBand;
          void main(){
            vec3 d = normalize(vDir);
            vec3 n = normalize(vec3(0.35, 0.82, 0.45));          // galactic plane normal
            float h = dot(d, n);
            float bandMask = exp(-pow(h/0.16, 2.0));
            float glow = exp(-pow(h/0.42, 2.0));
            vec3 core = normalize(vec3(-0.6, -0.2, -0.75));      // galactic centre direction
            float coreMask = pow(max(dot(d, core), 0.0), 6.0);
            float clouds = fbm(d*3.2);
            float dust = smoothstep(0.45, 0.75, fbm(d*7.0 + 3.0)) * exp(-pow(h/0.05, 2.0));
            vec3 col = vec3(0.004, 0.008, 0.022) + vec3(0.0, 0.01, 0.03) * (1.0 - abs(d.y));
            vec3 bandCol = mix(vec3(0.10, 0.16, 0.32), vec3(0.75, 0.58, 0.32), coreMask*1.6);
            col += bandCol * bandMask * (0.25 + 0.75*clouds) * uBand * (1.0 - dust*0.85);
            col += vec3(0.05, 0.08, 0.18) * glow * uBand * 0.6;
            col += vec3(0.95, 0.72, 0.42) * coreMask * bandMask * 0.55 * uBand;
            float neb = smoothstep(0.52, 0.85, fbm(d*2.1 + vec3(5.0)));
            col += vec3(0.03, 0.07, 0.17) * neb * 0.9;
            float mic = pow(hash3(floor(d*900.0)), 60.0);        // dust of faint stars
            col += vec3(0.8, 0.85, 1.0) * mic * (0.4 + bandMask*1.4);
            gl_FragColor = vec4(col * uIntensity, 1.0);
          }`,
      }),
    [intensity, band],
  );
  return (
    <mesh material={mat} renderOrder={-10}>
      <sphereGeometry args={[900, 48, 32]} />
    </mesh>
  );
};

/** Bright stars as round soft points with a little colour variation (parallax with camera moves). */
export const Stars: React.FC<{ count?: number; radius?: number; seed?: number; time?: number }> = ({ count = 5000, radius = 600, seed = 1, time = 0 }) => {
  const geo = useMemo(() => {
    let s = seed * 9301 + 49297;
    const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
    const pos = new Float32Array(count * 3), col = new Float32Array(count * 3), size = new Float32Array(count), ph = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const u = rnd() * 2 - 1, th = rnd() * Math.PI * 2, r = radius * (0.8 + rnd() * 0.2);
      const q = Math.sqrt(1 - u * u);
      pos.set([r * q * Math.cos(th), r * u, r * q * Math.sin(th)], i * 3);
      const t = rnd();
      const c = t < 0.12 ? [1.0, 0.82, 0.55] : t < 0.4 ? [0.72, 0.82, 1.0] : [1, 1, 1];
      col.set(c, i * 3);
      size[i] = Math.pow(rnd(), 6) * 9 + 1.2;
      ph[i] = rnd() * 6.28;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    g.setAttribute("size", new THREE.BufferAttribute(size, 1));
    g.setAttribute("phase", new THREE.BufferAttribute(ph, 1));
    return g;
  }, [count, radius, seed]);
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uTime: { value: 0 }, uScale: { value: 1 } },
        vertexShader: `attribute float size; attribute float phase; attribute vec3 color; varying vec3 vCol; varying float vTw; uniform float uTime; uniform float uScale;
          void main(){ vCol = color; vTw = 0.82 + 0.18*sin(uTime*2.0 + phase*5.0);
            gl_PointSize = size * uScale; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
        fragmentShader: `varying vec3 vCol; varying float vTw;
          void main(){ vec2 p = gl_PointCoord*2.0-1.0; float r = dot(p,p); if(r>1.0) discard;
            float a = exp(-r*4.5) + 0.25*exp(-r*30.0); gl_FragColor = vec4(vCol*a*vTw, 1.0); }`,
      }),
    [],
  );
  mat.uniforms.uTime.value = time;
  return <points geometry={geo} material={mat} renderOrder={-9} />;
};
