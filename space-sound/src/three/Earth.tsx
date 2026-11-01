import React, { useMemo } from "react";
import * as THREE from "three";
import { continueRender, delayRender, staticFile } from "remotion";
import { useThree } from "@react-three/fiber";

/** Loads textures and holds the render until they are ready. */
function useTextures(urls: string[]) {
  const [handle] = React.useState(() => delayRender("Earth textures"));
  const [tex, setTex] = React.useState<THREE.Texture[] | null>(null);
  React.useEffect(() => {
    const loader = new THREE.TextureLoader();
    Promise.all(urls.map((u) => loader.loadAsync(u))).then((t) => {
      t.forEach((x) => (x.anisotropy = 8));
      setTex(t);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return { tex, handle };
}

/** After the Earth mesh mounts, draw once more and only then let Remotion capture the frame. */
const ReadyGate: React.FC<{ handle: number }> = ({ handle }) => {
  const advance = useThree((s) => s.advance);
  React.useEffect(() => {
    requestAnimationFrame(() => {
      advance(performance.now());
      requestAnimationFrame(() => continueRender(handle));
    });
  }, [advance, handle]);
  return null;
};

/** Earth from NASA imagery: day map, golden city lights on the night side, ocean glint, atmosphere rim. */
export const Earth: React.FC<{ rot: number; sunDir: THREE.Vector3 }> = (p) => {
  const { tex, handle } = useTextures([staticFile("earth/earth-blue-marble.jpg"), staticFile("earth/earth-night.jpg"), staticFile("earth/earth-water.png")]);
  return tex ? (
    <>
      <EarthBody {...p} tex={tex} />
      <ReadyGate handle={handle} />
    </>
  ) : null;
};

const EarthBody: React.FC<{ rot: number; sunDir: THREE.Vector3; tex: THREE.Texture[] }> = ({ rot, sunDir, tex }) => {
  const [day, night, water] = tex;
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uDay: { value: day }, uNight: { value: night }, uWater: { value: water }, uSun: { value: new THREE.Vector3() } },
        vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vW; varying vec3 vV;
          void main(){ vUv = uv; vN = normalize(mat3(modelMatrix)*normal); vec4 w = modelMatrix*vec4(position,1.0); vW = w.xyz; vV = normalize(cameraPosition - w.xyz); gl_Position = projectionMatrix*viewMatrix*w; }`,
        fragmentShader: `uniform sampler2D uDay; uniform sampler2D uNight; uniform sampler2D uWater; uniform vec3 uSun;
          varying vec2 vUv; varying vec3 vN; varying vec3 vW; varying vec3 vV;
          void main(){
            vec3 n = normalize(vN); float l = dot(n, normalize(uSun));
            float dayMix = smoothstep(-0.12, 0.22, l);
            vec3 dayC = pow(texture2D(uDay, vUv).rgb, vec3(2.2));
            dayC = dayC * vec3(0.92, 0.98, 1.08);
            float wtr = texture2D(uWater, vUv).r;
            vec3 h = normalize(normalize(uSun) + vV);
            float spec = pow(max(dot(n,h),0.0), 60.0) * wtr * 1.6;
            vec3 lit = dayC * max(l, 0.0) * 1.35 + vec3(1.0,0.86,0.6) * spec * max(l,0.0);
            vec3 nightC = texture2D(uNight, vUv).rgb;
            float city = dot(nightC, vec3(0.33));
            vec3 lights = vec3(1.0, 0.72, 0.32) * pow(smoothstep(0.05, 0.75, city), 1.6) * 1.8;
            vec3 c = mix(lights + dayC*0.012, lit, dayMix);
            float rim = pow(1.0 - max(dot(n, vV), 0.0), 3.0);
            c += vec3(0.25, 0.5, 1.0) * rim * (0.25 + 0.9*smoothstep(-0.3, 0.6, l));
            c = c / (1.0 + c*0.35);
            gl_FragColor = vec4(pow(c, vec3(1.0/2.2)), 1.0);
          }`,
      }),
    [day, night, water],
  );
  mat.uniforms.uSun.value.copy(sunDir).normalize();
  const atmo = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        uniforms: { uSun: { value: new THREE.Vector3() } },
        vertexShader: `varying vec3 vN; varying vec3 vV; void main(){ vN = normalize(mat3(modelMatrix)*normal); vec4 w = modelMatrix*vec4(position,1.0); vV = normalize(cameraPosition - w.xyz); gl_Position = projectionMatrix*viewMatrix*w; }`,
        fragmentShader: `uniform vec3 uSun; varying vec3 vN; varying vec3 vV;
          void main(){ float f = pow(1.0 - abs(dot(normalize(vN), vV)), 2.2); float l = smoothstep(-0.35, 0.5, dot(normalize(vN), normalize(uSun)));
            vec3 c = mix(vec3(0.08,0.2,0.6), vec3(0.35,0.6,1.0), l) * f * (0.35 + l) * 1.6; gl_FragColor = vec4(c, f); }`,
      }),
    [],
  );
  atmo.uniforms.uSun.value.copy(sunDir).normalize();
  return (
    <group>
      <mesh material={mat} rotation={[0.4, rot, 0.1]}>
        <sphereGeometry args={[10, 128, 96]} />
      </mesh>
      <mesh material={atmo} scale={1.035}>
        <sphereGeometry args={[10, 96, 64]} />
      </mesh>
    </group>
  );
};

/** A golden sun with a soft bloom, as a camera-facing sprite. */
export const Sun: React.FC<{ position: [number, number, number]; size?: number; intensity?: number }> = ({ position, size = 40, intensity = 1 }) => {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uI: { value: 1 } },
        vertexShader: `varying vec2 vUv; void main(){ vUv = uv; vec4 mv = modelViewMatrix*vec4(0.0,0.0,0.0,1.0); mv.xy += position.xy; gl_Position = projectionMatrix*mv; }`,
        fragmentShader: `varying vec2 vUv; uniform float uI;
          void main(){ vec2 p = vUv-0.5; float r = length(p)*2.0;
            float a = exp(-r*r*60.0)*3.0 + exp(-r*7.0)*0.6 + exp(-r*2.2)*0.18;
            float streak = exp(-abs(p.y)*220.0) * exp(-abs(p.x)*3.5) * 0.7;
            vec3 c = vec3(1.0,0.85,0.6)*(a+streak)*uI; gl_FragColor = vec4(c, clamp(a+streak,0.0,1.0)); }`,
      }),
    [],
  );
  mat.uniforms.uI.value = intensity;
  return (
    <mesh position={position} material={mat}>
      <planeGeometry args={[size, size]} />
    </mesh>
  );
};
