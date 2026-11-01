import React, { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useVideoConfig } from "remotion";
import { Camera, Lights, Mood, Sky, Stage, box, sphere } from "./Common";
import { Person } from "./Person";
import { clamp, lerp, rand, smooth } from "../anim";
import { locate } from "../geo";

export type Scene3DProps = {
  t: number; // seconds into the scene
  dur: number;
  mood: Mood;
  accent: string;
  accent2: string;
  camera: string;
  characterColor: string;
  imageUrl: string | null;
  fromPlace: string;
  toPlace: string;
};

/** Camera move by name, progress u (0..1) around a target. */
function moveCamera(kind: string, u: number, base: [number, number, number], target: [number, number, number]): [number, number, number] {
  const e = smooth(u);
  const [x, y, z] = base;
  switch (kind) {
    case "push_in":
      return [x, y, lerp(z, z * 0.62, e)];
    case "pull_out":
      return [x, y, lerp(z * 0.62, z, e)];
    case "crane":
      return [x, lerp(y + 4, y, e), z];
    case "orbit": {
      const a = lerp(-0.5, 0.5, e);
      const r = Math.hypot(x - target[0], z - target[2]);
      return [target[0] + Math.sin(a) * r, y, target[2] + Math.cos(a) * r];
    }
    case "tracking":
      return [lerp(x - 2, x + 2, e), y, z];
    default:
      return [x + Math.sin(u * 2) * 0.15, y, z];
  }
}

// ---------------- Globe with route ----------------
const toVec = (lat: number, lon: number, r: number) => {
  const phi = ((90 - lat) * Math.PI) / 180;
  const th = ((lon + 180) * Math.PI) / 180;
  return new THREE.Vector3(-r * Math.sin(phi) * Math.cos(th), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(th));
};

export const GlobeRoute: React.FC<Scene3DProps> = ({ t, dur, accent, accent2, fromPlace, toPlace, mood }) => {
  const u = clamp(t / dur);
  const { width, height } = useVideoConfig();
  const far = height > width ? 1.75 : 1;
  const a = toVec(...locate(fromPlace || "india"), 2.02);
  const b = toVec(...locate(toPlace || "usa"), 2.02);
  const curve = useMemo(() => {
    const mid = a.clone().add(b).multiplyScalar(0.5);
    mid.setLength(2 + a.distanceTo(b) * 0.55);
    return new THREE.QuadraticBezierCurve3(a, mid, b);
  }, [a.x, a.y, a.z, b.x, b.y, b.z]);
  const grow = smooth(clamp((u - 0.12) / 0.7));
  const tube = useMemo(() => new THREE.TubeGeometry(curve, 80, 0.018, 8, false), [curve]);
  const ocean = useMemo(() => new THREE.MeshPhysicalMaterial({ color: "#1f4fa8", roughness: 0.35, clearcoat: 0.6, emissive: "#0b1c48", emissiveIntensity: 0.4 }), []);
  const grid = useMemo(() => new THREE.MeshBasicMaterial({ color: "#8fb8ff", wireframe: true, transparent: true, opacity: 0.14 }), []);
  const arcMat = useMemo(() => new THREE.MeshBasicMaterial({ color: accent }), [accent]);
  const tubeRef = useRef<THREE.Mesh>(null);
  useLayoutEffect(() => {
    tube.setDrawRange(0, Math.floor(tube.index!.count * grow / 6) * 6);
  }, [tube, grow]);
  const plane = curve.getPoint(Math.max(0.001, grow));
  const ahead = curve.getPoint(Math.min(1, grow + 0.01));
  // Turn the globe so the midpoint of the route faces the camera.
  const mid = a.clone().add(b).normalize();
  const spinY = Math.atan2(mid.x, mid.z) * -1 + lerp(0.25, -0.25, u);
  const tilt = Math.asin(mid.y) * 0.8;
  return (
    <Stage>
      <color attach="background" args={[mood === "bright" ? "#0b1638" : "#050a1c"]} />
      <Camera pos={[0, 0.4, lerp(7.2, 6.0, smooth(u)) * far]} target={[0, 0, 0]} fov={40} />
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 3, 6]} intensity={2.4} />
      <pointLight position={[-6, -2, 4]} intensity={18} color={accent2} />
      {Array.from({ length: 140 }).map((_, i) => (
        <mesh key={i} geometry={sphere} position={[(rand(i) - 0.5) * 60, (rand(i + 9) - 0.5) * 40, -20 - rand(i + 3) * 20]} scale={0.04 + rand(i + 5) * 0.05}>
          <meshBasicMaterial color="#ffffff" />
        </mesh>
      ))}
      <group rotation={[tilt, spinY, 0]}>
        <mesh geometry={sphere} material={ocean} scale={2} />
        <mesh geometry={sphere} material={grid} scale={2.012} />
        <mesh ref={tubeRef} geometry={tube} material={arcMat} />
        {[a, b].map((v, i) => (
          <group key={i} position={v}>
            <mesh geometry={sphere} scale={0.06}>
              <meshBasicMaterial color={i ? accent2 : accent} />
            </mesh>
            <mesh geometry={sphere} scale={0.06 + 0.12 * ((t * 1.2 + i * 0.5) % 1)}>
              <meshBasicMaterial color={i ? accent2 : accent} transparent opacity={0.6 * (1 - ((t * 1.2 + i * 0.5) % 1))} />
            </mesh>
          </group>
        ))}
        {grow > 0.01 && grow < 0.999 ? (
          <group position={plane} ref={(g) => g?.lookAt(g.parent!.localToWorld(ahead.clone()))}>
            <mesh geometry={box} scale={[0.05, 0.05, 0.22]}>
              <meshStandardMaterial color="#ffffff" />
            </mesh>
            <mesh geometry={box} scale={[0.3, 0.015, 0.07]}>
              <meshStandardMaterial color="#ffffff" />
            </mesh>
          </group>
        ) : null}
      </group>
    </Stage>
  );
};

// ---------------- Street world (shared by street_walk / handover) ----------------
const House: React.FC<{ x: number; z: number; w: number; h: number; color: string; roof: string; flip?: boolean }> = ({ x, z, w, h, color, roof, flip }) => {
  const wall = useMemo(() => new THREE.MeshStandardMaterial({ color, roughness: 0.85 }), [color]);
  const roofM = useMemo(() => new THREE.MeshStandardMaterial({ color: roof, roughness: 0.7 }), [roof]);
  const win = useMemo(() => new THREE.MeshStandardMaterial({ color: "#bfe3ff", emissive: "#ffd98a", emissiveIntensity: 0.15, roughness: 0.2 }), []);
  const face = flip ? -1 : 1;
  return (
    <group position={[x, 0, z]}>
      <mesh geometry={box} material={wall} position={[0, h / 2, 0]} scale={[w, h, 3]} castShadow receiveShadow />
      <mesh material={roofM} position={[0, h + 0.6, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
        <coneGeometry args={[w * 0.85, 1.4, 4]} />
      </mesh>
      {[-0.28, 0.28].map((dx) => (
        <mesh key={dx} geometry={box} material={win} position={[dx * w, h * 0.62, face * 1.51]} scale={[w * 0.22, 0.7, 0.05]} />
      ))}
      <mesh geometry={box} position={[0, 0.75, face * 1.51]} scale={[0.8, 1.5, 0.06]}>
        <meshStandardMaterial color="#7a4b2f" />
      </mesh>
    </group>
  );
};

const Tree: React.FC<{ x: number; z: number; s?: number }> = ({ x, z, s = 1 }) => (
  <group position={[x, 0, z]} scale={s}>
    <mesh position={[0, 0.8, 0]} castShadow>
      <cylinderGeometry args={[0.1, 0.14, 1.6, 10]} />
      <meshStandardMaterial color="#7b5236" />
    </mesh>
    <mesh geometry={sphere} position={[0, 2.0, 0]} scale={0.85} castShadow>
      <meshStandardMaterial color="#4f9e4c" roughness={0.8} />
    </mesh>
    <mesh geometry={sphere} position={[0.35, 1.7, 0.2]} scale={0.6} castShadow>
      <meshStandardMaterial color="#5cb257" roughness={0.8} />
    </mesh>
  </group>
);

const Street: React.FC<{ palette: string[]; mood: Mood }> = ({ palette, mood }) => {
  const colors = ["#f3e2c7", "#d9e7f5", "#f5d0c5", "#e2f0d9", "#efe3f7", "#fbe7b5"];
  const roofs = ["#b0543f", "#4e6a8a", "#7d5a9e", "#3f7a62"];
  return (
    <>
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial color={mood === "night" ? "#2f3b2f" : "#8cc06f"} roughness={1} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.01, 0]} receiveShadow>
        <planeGeometry args={[200, 5]} />
        <meshStandardMaterial color="#5b5f6b" roughness={0.9} />
      </mesh>
      {[-2.8, 2.8].map((z) => (
        <mesh key={z} rotation-x={-Math.PI / 2} position={[0, 0.03, z]} receiveShadow>
          <planeGeometry args={[200, 1.4]} />
          <meshStandardMaterial color="#c9c4ba" roughness={0.9} />
        </mesh>
      ))}
      {Array.from({ length: 14 }).map((_, i) => (
        <mesh key={i} rotation-x={-Math.PI / 2} position={[-40 + i * 6, 0.02, 0]}>
          <planeGeometry args={[2.2, 0.15]} />
          <meshStandardMaterial color="#f1f1f1" />
        </mesh>
      ))}
      {Array.from({ length: 10 }).map((_, i) => (
        <House key={`n${i}`} x={-30 + i * 6.5} z={-6.2} w={4.6} h={3 + rand(i) * 2} color={colors[i % colors.length]} roof={roofs[i % roofs.length]} />
      ))}
      {Array.from({ length: 10 }).map((_, i) => (
        <Tree key={`t${i}`} x={-32 + i * 6.5 + 3.2} z={-4.1} s={0.9 + rand(i + 4) * 0.3} />
      ))}
    </>
  );
};

export const StreetWalk: React.FC<Scene3DProps> = ({ t, dur, mood, accent, accent2, characterColor, camera }) => {
  const u = clamp(t / dur);
  const x = lerp(-9, 3, u);
  const target: [number, number, number] = [x, 1.2, -1.8];
  const base: [number, number, number] = [x + 1.5, 2.4, 6.5];
  return (
    <Stage>
      <Sky mood={mood} />
      <Lights mood={mood} accent={accent} />
      <Camera pos={moveCamera(camera === "static" ? "tracking" : camera, u, base, target)} target={target} fov={38} />
      <Street palette={[accent, accent2]} mood={mood} />
      <Person p={[x, 0.03, -2.3]} rotY={Math.PI / 2} shirt={characterColor || accent} cap={characterColor || accent} pose={{ walk: t * 1.1, armReach: 0, nod: 0, wave: 0, carry: true }} parcel />
    </Stage>
  );
};

export const Handover: React.FC<Scene3DProps> = ({ t, dur, mood, accent, accent2, characterColor, camera }) => {
  const u = clamp(t / dur);
  const arrive = smooth(clamp(u / 0.4));
  const courierX = lerp(-4, -0.9, arrive);
  const reach = smooth(clamp((u - 0.4) / 0.2)) * (1 - smooth(clamp((u - 0.72) / 0.15)));
  const handed = u > 0.62;
  const nod = Math.sin(clamp((u - 0.7) / 0.3) * Math.PI * 2) * 0.15;
  const target: [number, number, number] = [0, 1.4, -3.4];
  return (
    <Stage>
      <Sky mood={mood} />
      <Lights mood={mood} accent={accent} />
      <Camera pos={moveCamera(camera, u, [1.8, 2.0, 3.6], target)} target={target} fov={40} />
      <Street palette={[accent, accent2]} mood={mood} />
      <Person
        p={[courierX, 0.03, -3.6]}
        rotY={u < 0.4 ? Math.PI / 2 : Math.PI / 2 - 0.2}
        shirt={characterColor || accent}
        cap={characterColor || accent}
        pose={{ walk: u < 0.4 ? t * 1.1 : 0, armReach: handed ? 0 : reach, nod: u > 0.7 ? nod : 0, wave: u > 0.85 ? t : 0, carry: !handed }}
        parcel={!handed}
      />
      <Person
        p={[0.45, 0.03, -3.9]}
        rotY={-Math.PI / 2 + 0.3}
        shirt={accent2}
        pants="#4b5563"
        skin="#e0b394"
        hair="#5b3a29"
        pose={{ walk: 0, armReach: handed ? 0.25 : reach * 0.8, nod: u > 0.7 ? -nod : 0, wave: 0, carry: handed }}
        parcel={handed}
      />
    </Stage>
  );
};

// ---------------- City flyover ----------------
export const CityFlyover: React.FC<Scene3DProps> = ({ t, dur, mood, accent, accent2 }) => {
  const u = clamp(t / dur);
  const n = 22;
  const ref = useRef<THREE.InstancedMesh>(null);
  const winRef = useRef<THREE.InstancedMesh>(null);
  const res = useMemo(
    () => ({
      geo: new THREE.BoxGeometry(1, 1, 1),
      mat: new THREE.MeshStandardMaterial({ color: mood === "night" ? "#232b45" : "#c9d3e6", roughness: 0.6, metalness: 0.2 }),
      winMat: new THREE.MeshBasicMaterial({ color: mood === "night" ? "#ffd27a" : "#e9f2ff" }),
    }),
    [mood],
  );
  useLayoutEffect(() => {
    if (!ref.current || !winRef.current) return;
    const m = new THREE.Matrix4();
    let k = 0;
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        const h = 2 + rand(i * 31 + j) ** 2 * 14;
        const w = 1.4 + rand(i + j * 7) * 0.8;
        m.compose(new THREE.Vector3((i - n / 2) * 3.2, h / 2, (j - n / 2) * 3.2), new THREE.Quaternion(), new THREE.Vector3(w, h, w));
        ref.current.setMatrixAt(i * n + j, m);
        for (let f = 1; f < h - 0.5 && k < 4000; f += 1.3) {
          if (rand(i * 7 + j * 13 + f) < 0.55) continue;
          m.compose(new THREE.Vector3((i - n / 2) * 3.2, f, (j - n / 2) * 3.2 + w / 2 + 0.01), new THREE.Quaternion(), new THREE.Vector3(w * 0.7, 0.35, 0.02));
          winRef.current.setMatrixAt(k++, m);
        }
      }
    winRef.current.count = k;
    ref.current.instanceMatrix.needsUpdate = true;
    winRef.current.instanceMatrix.needsUpdate = true;
  }, [res]);
  const z = lerp(28, -6, smooth(u));
  return (
    <Stage>
      <Sky mood={mood} />
      <Lights mood={mood} accent={accent} />
      <pointLight position={[0, 8, z - 8]} intensity={40} color={accent2} distance={40} />
      <Camera pos={[Math.sin(u * 2) * 4, 18 - u * 4, z]} target={[0, 2, z - 20]} fov={50} />
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[300, 300]} />
        <meshStandardMaterial color={mood === "night" ? "#0d1226" : "#9aa7b8"} />
      </mesh>
      <instancedMesh ref={ref} args={[res.geo, res.mat, n * n]} castShadow receiveShadow />
      <instancedMesh ref={winRef} args={[res.geo, res.winMat, 4000]} />
    </Stage>
  );
};

// ---------------- Product podium ----------------
export const ProductPodium: React.FC<Scene3DProps> = ({ t, dur, mood, accent, accent2, imageUrl }) => {
  const u = clamp(t / dur);
  const tex = useMemo(() => {
    if (!imageUrl) return null;
    const tx = new THREE.TextureLoader().load(imageUrl);
    tx.colorSpace = THREE.SRGBColorSpace;
    return tx;
  }, [imageUrl]);
  return (
    <Stage>
      <color attach="background" args={[mood === "bright" || mood === "calm" ? "#eef1ff" : "#0d1024"]} />
      <Camera pos={[Math.sin(lerp(-0.4, 0.4, smooth(u))) * 6, 2.2, Math.cos(lerp(-0.4, 0.4, smooth(u))) * 6]} target={[0, 1.3, 0]} fov={38} />
      <ambientLight intensity={0.4} />
      <spotLight position={[0, 8, 3]} angle={0.5} penumbra={0.8} intensity={120} castShadow color="#ffffff" />
      <pointLight position={[-4, 2, 2]} intensity={25} color={accent} />
      <pointLight position={[4, 2, -2]} intensity={25} color={accent2} />
      <mesh position={[0, 0.25, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[1.6, 1.75, 0.5, 64]} />
        <meshPhysicalMaterial color="#f5f6fb" roughness={0.25} clearcoat={1} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <circleGeometry args={[30, 64]} />
        <meshStandardMaterial color={mood === "bright" || mood === "calm" ? "#e4e8f7" : "#141831"} />
      </mesh>
      <group position={[0, 1.55 + Math.sin(t * 1.5) * 0.06, 0]} rotation={[0, Math.sin(t * 0.6) * 0.35, 0]}>
        {tex ? (
          <mesh castShadow>
            <planeGeometry args={[2, 2]} />
            <meshStandardMaterial map={tex} transparent side={THREE.DoubleSide} roughness={0.4} />
          </mesh>
        ) : (
          <mesh geometry={box} scale={[1, 1.2, 1]} castShadow>
            <meshPhysicalMaterial color={accent} roughness={0.2} clearcoat={1} />
          </mesh>
        )}
      </group>
      {Array.from({ length: 50 }).map((_, i) => {
        const a = rand(i) * Math.PI * 2 + t * 0.3;
        const r = 2 + rand(i + 4) * 2.5;
        return (
          <mesh key={i} geometry={sphere} position={[Math.cos(a) * r, 0.5 + ((rand(i + 8) * 4 + t * 0.4) % 4), Math.sin(a) * r]} scale={0.025}>
            <meshBasicMaterial color={i % 2 ? accent : accent2} />
          </mesh>
        );
      })}
    </Stage>
  );
};

export const SCENES_3D = { globe_route: GlobeRoute, street_walk: StreetWalk, handover: Handover, city_flyover: CityFlyover, product_podium: ProductPodium } as const;
