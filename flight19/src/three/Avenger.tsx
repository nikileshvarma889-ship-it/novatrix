import React, { useMemo } from "react";
import * as THREE from "three";

/**
 * Grumman TBM Avenger at real scale (1 unit = 1 m): 12.5 m long, 16.5 m span.
 * +X is forward (nose), +Y up, +Z to the left wing. Origin near the centre of gravity.
 */
export type AvengerProps = {
  code?: string;          // fuselage code, e.g. "FT-28"
  prop?: number;          // propeller angle (radians); large values = blurred disc
  gear?: number;          // 1 = down, 0 = retracted
  ghost?: boolean;        // the fictional sixth aircraft: unmarked, dark, cold
  lights?: number;        // nav/exhaust glow 0..1
  env?: THREE.Texture | null;
};

function useDecal(draw: (x: CanvasRenderingContext2D, w: number, h: number) => void, w = 512, h = 256) {
  return useMemo(() => {
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const x = c.getContext("2d")!;
    draw(x, w, h);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

/** 1943–47 US national insignia: white star in a blue disc, white bars, blue outline. */
function drawInsignia(x: CanvasRenderingContext2D, w: number, h: number) {
  x.clearRect(0, 0, w, h);
  const cx = w / 2, cy = h / 2, r = h * 0.42;
  const blue = "#1d2b55";
  x.fillStyle = blue;
  x.fillRect(cx - r * 2.05, cy - r * 0.5, r * 4.1, r * 1.0);
  x.fillStyle = "#e9e6dc";
  x.fillRect(cx - r * 1.95, cy - r * 0.38, r * 3.9, r * 0.76);
  x.beginPath(); x.arc(cx, cy, r * 1.08, 0, Math.PI * 2); x.fillStyle = blue; x.fill();
  x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fillStyle = blue; x.fill();
  x.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 === 0 ? r * 0.96 : r * 0.38;
    x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  x.closePath(); x.fillStyle = "#e9e6dc"; x.fill();
}

const fuselageProfile = (): THREE.Vector2[] => {
  // (radius, x) pairs from tail (x=-7.3) to nose (x=4.9); lathe revolves around Y, rotated to X later
  const pts: [number, number][] = [
    [0.02, -7.3], [0.18, -7.1], [0.3, -6.4], [0.45, -5.2], [0.62, -3.6], [0.8, -2.0], [0.92, -0.6],
    [0.98, 0.6], [0.98, 2.0], [0.95, 3.0], [0.9, 3.6], [0.86, 4.1], [0.84, 4.6], [0.78, 4.9],
  ];
  return pts.map(([r, x]) => new THREE.Vector2(r, x));
};

function wingShape(span: number, root: number, tip: number, sweep = 0.35) {
  // planform in (x = chord direction, y = spanwise) — one side, root at y=0
  const s = new THREE.Shape();
  s.moveTo(-root * 0.35, 0);
  s.lineTo(root * 0.65, 0);
  s.lineTo(tip * 0.62 - sweep * 0.1, span * 0.94);
  s.quadraticCurveTo(tip * 0.5 - sweep * 0.1, span, -tip * 0.2 - sweep * 0.1, span);
  s.lineTo(-tip * 0.38 - sweep, span * 0.94);
  s.lineTo(-root * 0.35, 0);
  return s;
}

export const Avenger: React.FC<AvengerProps> = ({ code = "FT-28", prop = 0, gear = 0, ghost = false, lights = 0, env = null }) => {
  const insignia = useDecal(drawInsignia);
  const codeTex = useDecal((x, w, h) => {
    x.clearRect(0, 0, w, h);
    x.fillStyle = "#e9e6dc";
    x.font = "bold 150px 'Liberation Mono', monospace";
    x.textAlign = "center"; x.textBaseline = "middle";
    x.fillText(code, w / 2, h / 2 + 6);
  });
  const geo = useMemo(() => {
    const fus = new THREE.LatheGeometry(fuselageProfile(), 40);
    fus.rotateZ(-Math.PI / 2);
    fus.scale(1, 1.18, 1);
    const wing = new THREE.ExtrudeGeometry(wingShape(7.6, 3.1, 1.45), { depth: 0.26, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.08, bevelSegments: 3, curveSegments: 10 });
    wing.translate(0, 0, -0.13);
    const htail = new THREE.ExtrudeGeometry(wingShape(3.1, 1.75, 0.95, 0.25), { depth: 0.12, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 2 });
    htail.translate(0, 0, -0.06);
    const fin = new THREE.Shape();
    fin.moveTo(-0.2, 0); fin.lineTo(1.75, 0); fin.quadraticCurveTo(1.6, 1.7, 0.45, 2.35); fin.quadraticCurveTo(-0.1, 2.4, -0.25, 2.1); fin.lineTo(-0.2, 0);
    const finG = new THREE.ExtrudeGeometry(fin, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.05, bevelSegments: 2 });
    finG.translate(0, 0, -0.05);
    return { fus, wing, htail, finG };
  }, []);
  const m = useMemo(() => {
    const paint = ghost
      ? new THREE.MeshStandardMaterial({ color: "#0e1218", roughness: 0.55, metalness: 0.35, envMap: env, envMapIntensity: 0.4 })
      : new THREE.MeshStandardMaterial({ color: "#22324d", roughness: 0.38, metalness: 0.25, envMap: env, envMapIntensity: 0.9 });
    const belly = ghost ? paint : new THREE.MeshStandardMaterial({ color: "#2a3b57", roughness: 0.42, metalness: 0.2, envMap: env, envMapIntensity: 0.8 });
    const dark = new THREE.MeshStandardMaterial({ color: "#121418", roughness: 0.6, metalness: 0.5, envMap: env, envMapIntensity: 0.5 });
    const steel = new THREE.MeshStandardMaterial({ color: "#8a8f98", roughness: 0.35, metalness: 0.9, envMap: env });
    const glass = new THREE.MeshPhysicalMaterial({ color: ghost ? "#05070a" : "#9fb4c8", roughness: 0.05, metalness: 0.1, transmission: 0, transparent: true, opacity: ghost ? 0.95 : 0.35, envMap: env, envMapIntensity: 1.6 });
    const frame = paint;
    const tire = new THREE.MeshStandardMaterial({ color: "#151515", roughness: 0.9 });
    const decal = new THREE.MeshStandardMaterial({ map: insignia, transparent: true, roughness: 0.45, polygonOffset: true, polygonOffsetFactor: -4, envMap: env, envMapIntensity: 0.5 });
    const codeM = new THREE.MeshStandardMaterial({ map: codeTex, transparent: true, roughness: 0.45, polygonOffset: true, polygonOffsetFactor: -4 });
    const blur = new THREE.MeshBasicMaterial({ color: "#20242a", transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false });
    const exhaust = new THREE.MeshBasicMaterial({ color: "#ff8a3a" });
    const navR = new THREE.MeshBasicMaterial({ color: "#ff2a1a" });
    const navG = new THREE.MeshBasicMaterial({ color: "#2aff7a" });
    return { paint, belly, dark, steel, glass, frame, tire, decal, codeM, blur, exhaust, navR, navG };
  }, [env, ghost, insignia, codeTex]);
  m.exhaust.color.setRGB(1 * lights + 0.05, 0.55 * lights + 0.03, 0.2 * lights + 0.02);

  const spinning = Math.abs(prop) > 50;
  const blades = [0, 1, 2].map((i) => (
    <mesh key={i} material={m.dark} rotation={[prop + (i * Math.PI * 2) / 3, 0, 0]} position={[0, 0, 0]}>
      <boxGeometry args={[0.06, 1.95, 0.22]} />
    </mesh>
  ));
  const gearRot = (1 - gear) * 1.45;
  const Gear: React.FC<{ z: number }> = ({ z }) => (
    <group position={[0.9, -0.55, z]} rotation={[z > 0 ? -gearRot : gearRot, 0, 0]}>
      <mesh material={m.steel} position={[0, -0.75, 0]}><cylinderGeometry args={[0.07, 0.07, 1.5, 10]} /></mesh>
      <mesh material={m.tire} position={[0, -1.5, 0]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.42, 0.42, 0.22, 24]} /></mesh>
    </group>
  );
  return (
    <group>
      {/* fuselage */}
      <mesh geometry={geo.fus} material={m.paint} castShadow />
      {/* cowling + engine face + propeller */}
      <mesh material={m.paint} position={[4.95, 0, 0]} rotation={[0, 0, -Math.PI / 2]}><cylinderGeometry args={[0.9, 0.98, 0.9, 40, 1, true]} /></mesh>
      <mesh material={m.dark} position={[5.38, 0, 0]} rotation={[0, 0, -Math.PI / 2]}><circleGeometry args={[0.88, 40]} /></mesh>
      <group position={[5.5, 0, 0]}>
        <mesh material={m.steel} rotation={[0, 0, -Math.PI / 2]}><coneGeometry args={[0.32, 0.6, 24]} /></mesh>
        {spinning ? (
          <mesh material={m.blur} rotation={[0, Math.PI / 2, 0]} position={[0.1, 0, 0]}><circleGeometry args={[2.0, 48]} /></mesh>
        ) : (
          <group position={[0.05, 0, 0]}>{blades}</group>
        )}
      </group>
      {/* exhaust glow (night) */}
      {[-1, 1].map((s) => (
        <mesh key={s} material={m.exhaust} position={[4.3, -0.35, 0.78 * s]}><sphereGeometry args={[0.07, 8, 6]} /></mesh>
      ))}
      {/* greenhouse canopy with frames, turret */}
      <group position={[1.6, 0.98, 0]}>
        <mesh material={m.glass} scale={[3.4, 0.62, 0.62]}><sphereGeometry args={[1, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} /></mesh>
        {[-1.5, -0.6, 0.3, 1.2, 2.0].map((x) => (
          <mesh key={x} material={m.frame} position={[x, 0, 0]} rotation={[0, Math.PI / 2, 0]} scale={[1, 1, 1]}>
            <torusGeometry args={[0.6 * Math.sqrt(Math.max(0.05, 1 - (x / 3.4) ** 2)), 0.035, 6, 24, Math.PI]} />
          </mesh>
        ))}
        <mesh material={m.frame} position={[0, 0.6, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.035, 0.035, 5.4, 6]} /></mesh>
      </group>
      <group position={[-1.85, 1.15, 0]}>
        <mesh material={m.glass}><sphereGeometry args={[0.55, 24, 16]} /></mesh>
        <mesh material={m.dark} position={[0.45, 0.1, 0]} rotation={[0, 0, -Math.PI / 2 + 0.15]}><cylinderGeometry args={[0.03, 0.03, 0.9, 6]} /></mesh>
      </group>
      {/* wings (with dihedral) */}
      {[-1, 1].map((s) => (
        <group key={s} position={[0.7, -0.45, 0.55 * s]} rotation={[s * (Math.PI / 2 - 0.09), 0, 0]}>
          <mesh geometry={geo.wing} material={m.paint} castShadow />
          {!ghost && s > 0 ? (
            <mesh material={m.decal} position={[-0.1, 5.5, -0.22]} rotation={[Math.PI, 0, Math.PI / 2]}><planeGeometry args={[2.9, 1.45]} /></mesh>
          ) : null}
          <mesh material={s > 0 ? m.navR : m.navG} position={[0.1, 7.55, 0]}><sphereGeometry args={[0.06, 8, 6]} /></mesh>
        </group>
      ))}
      {/* fuselage insignia + code */}
      {!ghost
        ? [-1, 1].map((s) => (
            <group key={s}>
              <mesh material={m.decal} position={[-2.8, 0.05, 0.86 * s]} rotation={[0, s > 0 ? 0 : Math.PI, 0]}><planeGeometry args={[1.9, 0.95]} /></mesh>
              <mesh material={m.codeM} position={[-4.9, 0.1, 0.56 * s]} rotation={[0, s > 0 ? 0 : Math.PI, 0]}><planeGeometry args={[1.5, 0.75]} /></mesh>
            </group>
          ))
        : null}
      {/* tail */}
      {[-1, 1].map((s) => (
        <group key={s} position={[-5.6, 0.15, 0.2 * s]} rotation={[s * (Math.PI / 2 - 0.05), 0, 0]}>
          <mesh geometry={geo.htail} material={m.paint} />
        </group>
      ))}
      <group position={[-6.9, 0.35, 0]}>
        <mesh geometry={geo.finG} material={m.paint} />
      </group>
      <Gear z={1.7} />
      <Gear z={-1.7} />
      <mesh material={m.tire} position={[-6.2, -0.6 * gear - 0.2, 0]} rotation={[Math.PI / 2, 0, 0]} scale={gear > 0.1 ? 1 : 0.001}><cylinderGeometry args={[0.18, 0.18, 0.1, 16]} /></mesh>
    </group>
  );
};
