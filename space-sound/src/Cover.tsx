import React from "react";
import { AbsoluteFill } from "remotion";
import { Canvas3D, HookScene } from "./Scenes";

/** Instagram cover: the hook frame with the question as a title. */
export const Cover: React.FC = () => (
  <AbsoluteFill style={{ background: "#000" }}>
    <Canvas3D><HookScene t={3.2} boomT={1.0} /></Canvas3D>
    <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 35%, rgba(0,0,0,0) 60%, rgba(0,0,0,0.7) 100%)" }} />
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 330 }}>
      <div style={{ fontFamily: "Noto Sans Telugu", fontWeight: 700, fontSize: 92, lineHeight: 1.28, color: "#fff", textAlign: "center", padding: "0 70px", textShadow: "0 6px 26px rgba(0,0,0,0.9)" }}>
        అంతరిక్షంలో <span style={{ color: "#FFC83D" }}>శబ్దం</span>
        <br />ఎందుకు <span style={{ color: "#FFC83D" }}>వినిపించదు?</span>
      </div>
    </AbsoluteFill>
  </AbsoluteFill>
);
