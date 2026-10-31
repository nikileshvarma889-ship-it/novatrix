import React, { useLayoutEffect } from "react";
import { AbsoluteFill, Audio, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { Character } from "./characters/Character";
import { Garden } from "./world/Garden";
import { Confetti } from "./world/Confetti";
import { cameraAt, poseAt } from "./choreography";
import { EndCard, Flash, TitleCard } from "./overlays/Overlays";

const CameraRig: React.FC<{ t: number; override?: ReturnType<typeof cameraAt> }> = ({ t, override }) => {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  useLayoutEffect(() => {
    const c = override ?? cameraAt(t);
    camera.position.set(...c.pos);
    camera.fov = c.fov;
    camera.near = 0.1;
    camera.far = 300;
    camera.updateProjectionMatrix();
    camera.lookAt(...c.target);
  }, [t, camera, override]);
  return null;
};

/** The 3D world at song time t (used by the video and the thumbnail). */
export const ParadeScene: React.FC<{ t: number; width: number; height: number; cam?: ReturnType<typeof cameraAt> }> = ({ t, width, height, cam }) => (
  <ThreeCanvas
    width={width}
    height={height}
    shadows
    gl={{ antialias: true }}
    onCreated={({ gl }) => {
      gl.shadowMap.type = THREE.PCFSoftShadowMap;
      gl.toneMapping = THREE.ACESFilmicToneMapping;
      gl.toneMappingExposure = 1.05;
    }}
  >
    <CameraRig t={t} override={cam} />
    <Garden t={t} />
    <Character kind="bubu" pose={poseAt("bubu", t)} />
    <Character kind="lulu" pose={poseAt("lulu", t)} />
    <Character kind="toto" pose={poseAt("toto", t)} />
    <Confetti t={t} start={46.0} />
  </ThreeCanvas>
);

export const LittleAnimalParade: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const t = frame / fps;
  return (
    <AbsoluteFill style={{ background: "#9fdcff" }}>
      <ParadeScene t={t} width={width} height={height} />
      <TitleCard from={Math.round(0.8 * fps)} to={Math.round(4.6 * fps)} />
      <Flash at={30 * fps} />
      <EndCard startFrame={46 * fps} />
      <Audio src={staticFile("audio/song.wav")} />
    </AbsoluteFill>
  );
};
