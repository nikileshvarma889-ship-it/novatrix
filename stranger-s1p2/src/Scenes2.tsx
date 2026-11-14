import React, { useMemo } from "react";
import * as THREE from "three";
import { Glow } from "./three/Lights";
import { Monster } from "./Monster";
import { Beam, Cam, clamp01, ease, Figure, flick, Ground, hash, lerp3, Limb, Shadow, sm, Trees, type V3 } from "./Scenes3D";

/* Part 2 set pieces. Original designs only: people are anonymous silhouettes, the creature is the
   original faceless shadow being from Part 1. No show likenesses, creature designs or logos. */

const canvasTex = (w: number, h: number, draw: (x: CanvasRenderingContext2D) => void) => {
  const c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d")!);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
};

/** A girl's silhouette: Figure plus shoulder-length-less buzz-cut head (just the plain head) and an oversized shirt. */
const Girl: React.FC<{ pos: V3; rotY?: number; t: number; shiver?: number; color?: string; arms?: "down" | "torch" }> = ({ pos, rotY = 0, t, shiver = 0, color = "#08090c", arms }) => {
  const dx = shiver * Math.sin(t * 37) * 0.004;
  return <Figure pos={[pos[0] + dx, pos[1], pos[2]]} rotY={rotY} scale={0.76} color={color} arms={arms} />;
};

// ====================================================================== S1: the house on a quiet street, a girl in the doorway, "011"
export const MapleHouse: React.FC<{ t: number; d: number; cutA: number; cutB: number }> = ({ t, d, cutA, cutB }) => {
  const m = useMemo(() => ({
    siding: new THREE.MeshStandardMaterial({ color: "#5b6470", roughness: 0.9 }),
    roof: new THREE.MeshStandardMaterial({ color: "#1c1f24", roughness: 1 }),
    win: new THREE.MeshBasicMaterial({ color: "#ffc77a", toneMapped: false }),
    door: new THREE.MeshStandardMaterial({ color: "#3b2a1f", roughness: 0.7 }),
    skin: new THREE.MeshStandardMaterial({ color: "#c79c84", roughness: 0.6 }),
    sleeve: new THREE.MeshStandardMaterial({ color: "#6a7f9a", roughness: 1 }),
  }), []);
  const ink = useMemo(() => canvasTex(512, 256, (x) => {
    x.clearRect(0, 0, 512, 256); x.fillStyle = "rgba(28,36,58,0.85)"; x.font = "bold 190px 'Liberation Mono', monospace"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText("011", 256, 136);
  }), []);
  if (t < cutA) {
    // exterior: a two-storey suburban house in fog, two small figures hurry to the side door
    const k = ease(clamp01(t / cutA));
    const walk = clamp01(t / cutA);
    return (
      <>
        <Cam pos={lerp3([-7, 1.4, 12], [-5, 1.6, 9], k)} look={[0, 2, 0]} fov={42} />
        <color attach="background" args={["#0f1724"]} />
        <fogExp2 attach="fog" args={["#0f1724", 0.05]} />
        <ambientLight intensity={0.25} color="#5a72a0" />
        <directionalLight position={[-10, 20, 10]} intensity={0.6} color="#8aa3d6" />
        <Ground color="#121a14" />
        <group>
          <mesh material={m.siding} position={[0, 2.5, 0]}><boxGeometry args={[9, 5, 7]} /></mesh>
          <mesh material={m.roof} position={[0, 6.2, 0]} rotation={[0, Math.PI / 4, 0]} scale={[1, 1, 0.75]}><coneGeometry args={[6.6, 2.4, 4]} /></mesh>
          {[[-2.8, 1.5], [2.8, 1.5], [-2.8, 3.8], [0.5, 3.8], [2.8, 3.8]].map(([x, y], i) => (
            <mesh key={i} material={i === 3 ? m.roof : m.win} position={[x, y, 3.51]}><planeGeometry args={[1.3, 1.2]} /></mesh>
          ))}
          <mesh material={m.door} position={[0, 1.1, 3.51]}><planeGeometry args={[1.1, 2.2]} /></mesh>
          <pointLight position={[0, 2.6, 4.2]} intensity={6} distance={7} color="#ffcf8a" />
          <Glow pos={[0, 2.6, 3.7]} color="#ffcf8a" size={0.8} intensity={0.9} fog />
          {[[-2.8, 1.5], [2.8, 1.5], [-2.8, 3.8], [2.8, 3.8]].map(([x, y], i) => <Glow key={i} pos={[x, y, 3.7]} color="#ffc77a" size={1.6} intensity={0.35} fog />)}
        </group>
        <Trees seed={4} xMin={-30} xMax={30} zMin={-30} zMax={-6} gap={0} count={90} color="#0c100c" />
        <Figure pos={lerp3([-3.6, 0, 8], [-0.6, 0, 4.6], walk)} rotY={Math.PI * 0.82} scale={0.8} walk={1} t={t} color="#07080a" />
        <Girl pos={lerp3([-4.4, 0, 8.6], [-1.3, 0, 5.0], walk)} rotY={Math.PI * 0.82} t={t} />
      </>
    );
  }
  if (t < cutB) {
    // inside: she stands in a bedroom doorway, backlit, trembling; slow push-in
    const k = ease(clamp01((t - cutA) / (cutB - cutA)));
    return (
      <>
        <Cam pos={lerp3([0.2, 1.25, 4.2], [0.05, 1.2, 2.6], k)} look={[0, 1.05, 0]} fov={38} />
        <color attach="background" args={["#020204"]} />
        <ambientLight intensity={0.04} color="#5a6a90" />
        <mesh position={[0, 1.5, -0.4]}><planeGeometry args={[8, 4]} /><meshStandardMaterial color="#262a33" roughness={1} /></mesh>
        <mesh position={[0, 1.05, -0.39]}><planeGeometry args={[0.95, 2.1]} /><meshBasicMaterial color="#f2d7a8" toneMapped={false} /></mesh>
        <Glow pos={[0, 1.2, -0.35]} color="#ffd7a0" size={3.2} intensity={0.5} />
        <pointLight position={[0, 1.4, -1]} intensity={5} distance={5} color="#ffd7a0" />
        <Girl pos={[0, 0, 0]} t={t} shiver={1} color="#050507" />
      </>
    );
  }
  // close-up: a forearm, sleeve pushed up, the tattooed number
  const k = ease(clamp01((t - cutB) / (d - cutB)));
  return (
    <>
      <Cam pos={lerp3([0.1, 0.0, 0.6], [0.03, 0.0, 0.4], k)} look={[0.0, 0, 0]} fov={34} roll={-0.06} />
      <color attach="background" args={["#030305"]} />
      <ambientLight intensity={0.08} color="#7a88b0" />
      <spotLight position={[0.6, 1.2, 0.8]} intensity={9} angle={0.5} penumbra={0.8} distance={4} color="#ffd9b0" />
      <directionalLight position={[-1, 1, 1]} intensity={0.25} color="#7f94c8" />
      <mesh position={[0, -0.06, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[3, 3]} /><meshStandardMaterial color="#2c2622" roughness={1} /></mesh>
      <group rotation={[0, 0, Math.PI / 2]}>
        <mesh material={m.skin}><capsuleGeometry args={[0.045, 0.5, 6, 18]} /></mesh>
        <mesh material={m.sleeve} position={[0, 0.36, 0]}><cylinderGeometry args={[0.07, 0.075, 0.25, 18]} /></mesh>
      </group>
      <mesh position={[0.0, 0.0, 0.047]}><planeGeometry args={[0.1, 0.05]} /><meshStandardMaterial map={ink} transparent depthWrite={false} roughness={0.7} /></mesh>
    </>
  );
};

// ====================================================================== S2 / S8: the basement den
export const Den: React.FC<{ t: number; d: number; mode: "powers" | "freeze"; liftAt?: number; whisperAt?: number; blastAt?: number }> = ({ t, d, mode, liftAt = 1, whisperAt = 99, blastAt = 99 }) => {
  const m = useMemo(() => ({
    wall: new THREE.MeshStandardMaterial({ color: "#4a3f35", roughness: 1 }),
    floor: new THREE.MeshStandardMaterial({ color: "#3a2e25", roughness: 0.9 }),
    couch: new THREE.MeshStandardMaterial({ color: "#6b4a2c", roughness: 1 }),
    tv: new THREE.MeshStandardMaterial({ color: "#2a1f17", roughness: 0.6 }),
    toy: new THREE.MeshStandardMaterial({ color: "#a52a22", roughness: 0.4, metalness: 0.2 }),
    toy2: new THREE.MeshStandardMaterial({ color: "#2f4f7a", roughness: 0.5 }),
    toy3: new THREE.MeshStandardMaterial({ color: "#d9c27a", roughness: 0.5 }),
    blanket: new THREE.MeshStandardMaterial({ color: "#8a7a5a", roughness: 1 }),
  }), []);
  const lift = mode === "powers" ? sm(liftAt, liftAt + 1.6, t) : 0;
  const fall = mode === "powers" ? sm(d - 1.2, d - 0.9, t) : 0;
  const hover = (i: number) => lift * (1 - fall) * (0.55 + 0.12 * i + Math.sin(t * 2 + i) * 0.03);
  // lights: steady, then stutter (freeze mode), then violently strobe and burst
  const panic = mode === "freeze" ? sm(0.8, whisperAt, t) : 0;
  const dead = t >= blastAt;
  const lamp = dead ? 0 : mode === "freeze" ? flick(t, 7, 0.15 + panic * 0.75) : 0.9 + 0.1 * Math.sin(t * 9);
  const k = ease(clamp01(t / d));
  const close = mode === "freeze" && t > whisperAt - 1.2;
  return (
    <>
      {mode === "powers"
        ? <Cam pos={lerp3([2.4, 1.3, 2.8], [1.4, 1.05, 1.6], k)} look={[-0.2, 0.7, -0.2]} fov={44} />
        : close ? <Cam pos={lerp3([0.9, 1.15, 1.35], [0.55, 1.1, 0.85], ease(clamp01((t - whisperAt + 1.2) / (blastAt - whisperAt + 1.2))))} look={[-0.6, 1.1, -0.6]} fov={34} roll={Math.sin(t * 23) * 0.004 * panic} />
          : <Cam pos={lerp3([2.8, 1.6, 3.2], [2.2, 1.4, 2.4], k)} look={[-0.6, 0.9, -0.6]} fov={46} roll={Math.sin(t * 19) * 0.003 * panic} />}
      <color attach="background" args={["#020202"]} />
      <ambientLight intensity={0.04 + (dead ? -0.04 : 0)} color="#5a6a90" />
      <mesh material={m.floor} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[10, 10]} /></mesh>
      <mesh material={m.wall} position={[0, 1.5, -2.4]}><planeGeometry args={[10, 3]} /></mesh>
      <mesh material={m.wall} position={[-2.6, 1.5, 0]} rotation={[0, Math.PI / 2, 0]}><planeGeometry args={[10, 3]} /></mesh>
      {/* couch, old TV, a blanket fort */}
      <group position={[-1.2, 0, -1.6]}>
        <mesh material={m.couch} position={[0, 0.25, 0]}><boxGeometry args={[2.2, 0.5, 0.9]} /></mesh>
        <mesh material={m.couch} position={[0, 0.65, -0.35]}><boxGeometry args={[2.2, 0.5, 0.2]} /></mesh>
      </group>
      <group position={[1.6, 0, -1.8]}>
        <mesh material={m.tv} position={[0, 0.45, 0]}><boxGeometry args={[0.9, 0.7, 0.6]} /></mesh>
        <mesh position={[0, 0.48, 0.31]}><planeGeometry args={[0.6, 0.45]} /><meshBasicMaterial color={mode === "freeze" && !dead ? (flick(t, 3, 0.5) > 0.5 ? "#7f93b8" : "#1a2230") : "#141820"} toneMapped={false} /></mesh>
      </group>
      <mesh material={m.blanket} position={[-2.0, 0.55, 0.6]} rotation={[0, 0.4, 0]}><coneGeometry args={[0.9, 1.1, 4, 1, true]} /></mesh>
      {/* toys on the table that rise by themselves */}
      <mesh material={m.couch} position={[0, 0.25, 0]}><boxGeometry args={[1.0, 0.5, 0.6]} /></mesh>
      <mesh material={m.toy} position={[-0.25, 0.56 + hover(0), 0.05]} rotation={[lift * 0.4, t * 0.5 * lift, 0]}><boxGeometry args={[0.18, 0.1, 0.1]} /></mesh>
      <mesh material={m.toy2} position={[0.1, 0.57 + hover(1), -0.1]} rotation={[0, -t * 0.4 * lift, lift * 0.3]}><cylinderGeometry args={[0.05, 0.05, 0.14, 12]} /></mesh>
      <mesh material={m.toy3} position={[0.3, 0.56 + hover(2), 0.12]}><sphereGeometry args={[0.06, 16, 12]} /></mesh>
      {/* the girl and the boy (silhouettes) */}
      <Girl pos={[-0.6, 0, -0.6]} rotY={0.6} t={t} shiver={mode === "freeze" ? panic : 0} color="#060608" />
      <Figure pos={[1.1, 0, 0.4]} rotY={-2.3} scale={0.82} color="#060608" />
      {/* hanging bulbs */}
      {[[-0.6, -0.2], [1.2, -0.6]].map(([x, z], i) => {
        const on = i === 0 ? lamp : dead ? 0 : mode === "freeze" ? flick(t, 11 + i, 0.2 + panic * 0.7) : 1;
        return (
          <group key={i} position={[x, 2.5, z]}>
            <mesh position={[0, 0.2, 0]}><cylinderGeometry args={[0.005, 0.005, 0.4, 4]} /><meshBasicMaterial color="#111" /></mesh>
            {!dead && <Glow pos={[0, 0, 0]} color="#ffd29a" size={0.9} intensity={on} />}
            <pointLight intensity={on * 7} distance={7} decay={1.5} color="#ffcf8a" />
          </group>
        );
      })}
      {/* the burst: a white flash and sparks for a split second */}
      {t >= blastAt && t < blastAt + 0.25 ? (
        <>
          <pointLight position={[0.3, 2.4, -0.4]} intensity={60 * (1 - (t - blastAt) / 0.25)} distance={12} color="#fff6e8" />
          {Array.from({ length: 40 }, (_, i) => {
            const u = (t - blastAt) * 6, a = hash(i, 3) * Math.PI * 2, r = hash(i, 4) * u;
            return <mesh key={i} position={[(i % 2 ? -0.6 : 1.2) + Math.cos(a) * r, 2.5 - r * hash(i, 5) - u * u * 0.3, (i % 2 ? -0.2 : -0.6) + Math.sin(a) * r]}><sphereGeometry args={[0.012, 4, 3]} /><meshBasicMaterial color="#ffe9b0" toneMapped={false} /></mesh>;
          })}
        </>
      ) : null}
    </>
  );
};

// ====================================================================== the other side: a dead, colourless mirror of the town
const Particles: React.FC<{ t: number; center: V3; area: V3; count?: number }> = ({ t, center, area, count = 900 }) => {
  const { geo, mat, seeds } = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    const mat = new THREE.PointsMaterial({ color: "#c9d6e6", size: 0.035, transparent: true, opacity: 0.75, depthWrite: false, sizeAttenuation: true });
    return { geo, mat, seeds: Array.from({ length: count }, (_, i) => [hash(i, 11), hash(i, 12), hash(i, 13), hash(i, 14)]) };
  }, [count]);
  const p = geo.attributes.position.array as Float32Array;
  seeds.forEach(([a, b, c, e], i) => {
    const y = ((b * area[1] + t * (0.15 + e * 0.2)) % area[1]) - area[1] / 2;
    p.set([center[0] + (a - 0.5) * area[0] + Math.sin(t * 0.4 + i) * 0.2, center[1] + y, center[2] + (c - 0.5) * area[2] + Math.cos(t * 0.3 + i) * 0.2], i * 3);
  });
  geo.attributes.position.needsUpdate = true;
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(...center), 200);
  return <points geometry={geo} material={mat} frustumCulled={false} />;
};
const Vines: React.FC<{ seed: number; count?: number; spread?: number; z0?: number }> = ({ seed, count = 40, spread = 10, z0 = -4 }) => {
  const geos = useMemo(() => Array.from({ length: count }, (_, i) => {
    const x0 = (hash(i, seed) - 0.5) * spread * 2, z = z0 + (hash(i, seed + 1) - 0.5) * spread * 2;
    const pts = Array.from({ length: 7 }, (_, j) => new THREE.Vector3(x0 + j * (hash(i * 7 + j, seed + 2) - 0.5) * 0.9, 0.04 + hash(i * 7 + j, seed + 3) * 0.08, z + j * (hash(i, seed + 4) - 0.5) * 1.2));
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.025 + hash(i, seed + 5) * 0.03, 5, false);
  }), [seed, count, spread, z0]);
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#1d1f1c", roughness: 0.5, metalness: 0.1 }), []);
  return <>{geos.map((g, i) => <mesh key={i} geometry={g} material={mat} />)}</>;
};
const OtherSky: React.FC<{ fogD?: number }> = ({ fogD = 0.09 }) => (
  <>
    <color attach="background" args={["#18202c"]} />
    <fogExp2 attach="fog" args={["#18202c", fogD]} />
    <ambientLight intensity={0.35} color="#7d8ea8" />
    <directionalLight position={[5, 20, -10]} intensity={0.4} color="#9fb2cc" />
  </>
);

// ====================================================================== S3: a boy alone on the other side, then a living room of lights
export const WillJoyce: React.FC<{ t: number; d: number; cut: number }> = ({ t, d, cut }) => {
  const bulbs = useMemo(() => Array.from({ length: 26 }, (_, i) => {
    const row = Math.floor(i / 13), k = (i % 13) / 12;
    return { x: -2.6 + k * 5.2, y: 2.3 - row * 0.9 - Math.sin(k * Math.PI) * 0.18, c: ["#ff3b30", "#ffcc33", "#33cc66", "#3388ff", "#ff66cc"][i % 5] };
  }), []);
  if (t < cut) {
    const k = ease(clamp01(t / cut));
    return (
      <>
        <Cam pos={lerp3([0.6, 1.0, 5], [0.2, 0.95, 3.2], k)} look={[0, 0.8, -2]} fov={42} roll={Math.sin(t * 1.3) * 0.01} />
        <OtherSky />
        <Ground color="#20232a" />
        <Vines seed={3} count={50} spread={8} />
        <Trees seed={8} xMin={-20} xMax={20} zMin={-30} zMax={-1} gap={1.6} count={120} color="#14171c" />
        <Particles t={t} center={[0, 1.5, 0]} area={[10, 4, 10]} />
        {/* the boy runs, stops, looks around */}
        <Figure pos={[Math.sin(t * 0.8) * 0.3, 0, lerp3([0, 0, -6], [0, 0, -1.4], sm(0, cut * 0.7, t))[2]]} rotY={t > cut * 0.7 ? Math.sin(t * 2) * 0.9 : 0} scale={0.76} walk={t < cut * 0.7 ? 1.4 : 0} t={t * 1.4} color="#090a0d" />
      </>
    );
  }
  const tt = t - cut, k = ease(clamp01(tt / (d - cut)));
  return (
    <>
      <Cam pos={lerp3([1.4, 1.5, 4.4], [0.6, 1.5, 3.0], k)} look={[0, 1.6, 0]} fov={44} />
      <color attach="background" args={["#030303"]} />
      <ambientLight intensity={0.05} color="#7a6a5a" />
      <mesh position={[0, 1.5, -0.05]}><planeGeometry args={[8, 4]} /><meshStandardMaterial color="#5a4e42" roughness={1} /></mesh>
      <mesh position={[0, 0, 1.5]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[8, 5]} /><meshStandardMaterial color="#3a2f26" roughness={1} /></mesh>
      {bulbs.map((b, i) => {
        const on = flick(tt + i * 0.07, i + 40, 0.55) > 0.5 && Math.sin(tt * 6 - i * 0.6) > -0.3 ? 1 : 0.05;
        return (
          <group key={i}>
            <mesh position={[b.x, b.y, 0.02]}><sphereGeometry args={[0.035, 10, 8]} /><meshBasicMaterial color={on > 0.5 ? b.c : "#202020"} toneMapped={false} /></mesh>
            <Glow pos={[b.x, b.y, 0.06]} color={b.c} size={0.5} intensity={on * 0.7} />
          </group>
        );
      })}
      {[0, 6, 12, 19, 25].map((i) => <pointLight key={i} position={[bulbs[i].x, bulbs[i].y, 0.4]} intensity={flick(tt + i * 0.07, i + 40, 0.55) > 0.5 ? 1.6 : 0} distance={3} color={bulbs[i].c} />)}
      {/* a mother, alone, facing the wall of lights */}
      <Figure pos={[-0.9, 0, 0.9]} rotY={Math.PI + 0.3} scale={0.95} color="#050505" />
    </>
  );
};

// ====================================================================== S5 / S6: the pool party
export const Pool: React.FC<{ t: number; d: number; mode: "party" | "attack"; dropAt?: number; grabAt?: number }> = ({ t, d, mode, dropAt = 0.5, grabAt = 3 }) => {
  const m = useMemo(() => ({
    deck: new THREE.MeshStandardMaterial({ color: "#7d7a72", roughness: 0.8 }),
    house: new THREE.MeshStandardMaterial({ color: "#3d4450", roughness: 0.9 }),
    win: new THREE.MeshBasicMaterial({ color: "#ffbf73", toneMapped: false }),
    fence: new THREE.MeshStandardMaterial({ color: "#2a2620", roughness: 1 }),
  }), []);
  const waterMat = useMemo(() => new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 }, uRed: { value: 0 }, uDrop: { value: new THREE.Vector3(0, 0, -99) }, uLight: { value: 1 } },
    vertexShader: `varying vec2 vUv; varying vec3 vP; void main(){ vUv=uv; vP=(modelMatrix*vec4(position,1.0)).xyz; gl_Position=projectionMatrix*viewMatrix*vec4(vP,1.0); }`,
    fragmentShader: `uniform float uT; uniform float uRed; uniform vec3 uDrop; uniform float uLight; varying vec2 vUv; varying vec3 vP;
      void main(){ float c = sin(vP.x*5.0+uT*1.3)*sin(vP.z*6.0-uT*1.1)+sin((vP.x+vP.z)*9.0+uT*2.0)*0.5;
        vec3 col = mix(vec3(0.05,0.38,0.48), vec3(0.35,0.85,0.95), 0.5+0.25*c) * uLight;
        float r = length(vP.xz - uDrop.xy); float age = uT - uDrop.z;
        float ring = age > 0.0 ? exp(-pow((r - age*0.5)*14.0, 2.0)) * exp(-age*0.8) : 0.0;
        float red = age > 0.0 ? smoothstep(0.12 + age*0.12, 0.0, r) * uRed : 0.0;
        col += ring*0.5*uLight; col = mix(col, vec3(0.35,0.0,0.02)*max(uLight,0.25), clamp(red,0.0,0.85));
        gl_FragColor = vec4(col, 1.0); }`,
  }), []);
  const flickPool = mode === "attack" ? flick(t, 17, sm(grabAt - 1.2, grabAt, t) * 0.7) * (t > grabAt + 0.9 ? 0.03 : 1) : 1;
  waterMat.uniforms.uT.value = t;
  waterMat.uniforms.uLight.value = flickPool;
  waterMat.uniforms.uRed.value = mode === "attack" ? 1 : 0;
  waterMat.uniforms.uDrop.value.set(1.15, 1.15, mode === "attack" ? dropAt + 0.35 : -99);
  const k = ease(clamp01(t / d));
  const closeUp = mode === "attack" && t < grabAt - 0.6;
  const pulled = mode === "attack" ? sm(grabAt, grabAt + 0.6, t) : 0;
  const shadowIn = mode === "party" ? sm(d - 2.6, d - 1.4, t) * 0.8 : sm(grabAt - 1.0, grabAt - 0.2, t) * (1 - sm(grabAt + 0.6, grabAt + 1.0, t));
  return (
    <>
      {closeUp
        ? <Cam pos={lerp3([0.55, 1.5, 0.55], [0.75, 1.15, 0.75], ease(clamp01(t / (grabAt - 0.6))))} look={[1.15, 0.0, 1.15]} fov={36} />
        : mode === "party" ? <Cam pos={lerp3([-5, 4.6, 8.5], [-3.6, 3.6, 6.4], k)} look={[0.8, 0.2, 0.8]} fov={44} />
          : <Cam pos={[-3.4, 3.2, 5.8]} look={[1.2, 0.3, 1.4]} fov={40} roll={pulled * Math.sin(t * 40) * 0.01} />}
      <color attach="background" args={["#070b12"]} />
      <fogExp2 attach="fog" args={["#0b111b", 0.05]} />
      <ambientLight intensity={0.12} color="#6276a0" />
      <directionalLight position={[-10, 20, 8]} intensity={0.3} color="#8aa3d6" />
      <Ground color="#141a12" />
      <pointLight position={[3.2, 2.4, 3.2]} intensity={(mode === "attack" ? flickPool : 1) * 9} distance={9} color="#ffc98a" />
      <Glow pos={[3.2, 2.4, 3.2]} color="#ffc98a" size={0.7} intensity={(mode === "attack" ? flickPool : 1) * 0.9} fog />
      {/* deck and pool */}
      <mesh material={m.deck} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}><ringGeometry args={[3.0, 5.5, 4, 1]} /></mesh>
      <mesh material={waterMat} rotation={[-Math.PI / 2, 0, Math.PI / 4]} position={[0, 0.015, 0]}><planeGeometry args={[4.24, 4.24, 1, 1]} /></mesh>
      <pointLight position={[0, 0.2, 0]} intensity={8 * flickPool} distance={8} color="#5fd6e6" />
      <Glow pos={[0, 0, 0]} color="#5fd6e6" size={4} intensity={0.25 * flickPool} fog />
      {/* the house with the party inside */}
      <group position={[0, 0, -8]}>
        <mesh material={m.house} position={[0, 2.2, 0]}><boxGeometry args={[12, 4.4, 4]} /></mesh>
        {[-4, -1.5, 1.5, 4].map((x, i) => <mesh key={i} material={m.win} position={[x, 1.6, 2.01]}><planeGeometry args={[1.6, 1.4]} /></mesh>)}
        {[-4, -1.5, 1.5, 4].map((x, i) => <Glow key={i} pos={[x, 1.6, 2.2]} color="#ffbf73" size={2.2} intensity={mode === "attack" && t > grabAt ? 0.15 : 0.45} fog />)}
        {mode === "party" && [-1.8, -1.2, 1.3, 4.2].map((x, i) => <Figure key={i} pos={[x, 0.9, 1.6]} rotY={Math.sin(t + i) * 0.6} scale={0.7} color="#2a1c10" />)}
      </group>
      {/* fence and trees behind; the shadow among them */}
      {Array.from({ length: 30 }, (_, i) => <mesh key={i} material={m.fence} position={[8, 0.9, -6 + i * 0.5]}><boxGeometry args={[0.08, 1.8, 0.4]} /></mesh>)}
      <Trees seed={21} xMin={9} xMax={30} zMin={-20} zMax={12} gap={0} count={70} color="#0d100c" />
      <Monster pos={mode === "party" ? [4.6, 0, -0.8] : lerp3([2.6, 0, 2.6], [3.8, 0, 3.8], pulled)} rotY={mode === "party" ? -1.75 : -2.356} t={t} opacity={shadowIn} scale={0.95} walk={mode === "party" ? 0.4 : 0} reach={mode === "attack" ? sm(grabAt - 0.9, grabAt, t) : 0} />
      {/* the girl sitting alone at the pool's edge, then dragged away */}
      {pulled < 0.98 ? (
        <group position={lerp3([1.5, 0, 1.5], [3.6, 0, 3.6], pulled)} rotation={[0, -2.356, 0]}>
          <group rotation={[pulled * 1.1, 0, 0]}><Figure pos={[0, -0.45, 0]} scale={0.85} color="#06070a" /></group>
        </group>
      ) : null}
      {/* a drop of blood */}
      {mode === "attack" && t > dropAt && t < dropAt + 0.35 ? <mesh position={[1.15, 0.45 - (t - dropAt) * (t - dropAt) * 3.5, 1.15]}><sphereGeometry args={[0.014, 10, 8]} /><meshBasicMaterial color="#8a0008" /></mesh> : null}
    </>
  );
};

// ====================================================================== S7: she wakes on the other side; the thing comes out of the fog
export const OtherPool: React.FC<{ t: number; d: number }> = ({ t, d }) => {
  const k = ease(clamp01(t / d));
  const lookUp = 1 - sm(1.8, 3.6, t);
  return (
    <>
      <Cam pos={[0.2, 0.35 + (1 - lookUp) * 0.1, 3]} look={lerp3([0.1, 4, -1], [0, 0.9, -6], 1 - lookUp)} fov={48} roll={Math.sin(t * 0.7) * 0.02} />
      <OtherSky fogD={0.11} />
      <Ground color="#4a4f58" />
      {/* the same empty pool, dry and full of vines */}
      <mesh rotation={[-Math.PI / 2, 0, Math.PI / 4]} position={[0, -0.4, 0]}><planeGeometry args={[4.24, 4.24]} /><meshStandardMaterial color="#2a2d33" roughness={1} /></mesh>
      <Vines seed={9} count={70} spread={7} z0={-2} />
      <Trees seed={33} xMin={-25} xMax={25} zMin={-40} zMax={-4} gap={0} count={140} color="#15181d" />
      <Particles t={t} center={[0, 2, 0]} area={[10, 6, 10]} count={1200} />
      <Monster pos={lerp3([0.4, 0, -10], [0.2, 0, -3.2], sm(2.5, d, t))} t={t} opacity={sm(2.8, 4.2, t)} scale={1.1} walk={1} reach={sm(d - 2.5, d - 0.5, t)} />
      {k > 2 ? null : null}
    </>
  );
};

export { Beam, Limb };
