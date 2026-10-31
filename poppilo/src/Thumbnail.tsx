import React from "react";
import { AbsoluteFill } from "remotion";
import { ParadeScene } from "./Parade";
import { PoppiloLogo } from "./overlays/Overlays";

/** 1280x720 YouTube thumbnail: the three friends mid-dance + logo. */
export const Thumbnail: React.FC = () => (
  <AbsoluteFill>
    <ParadeScene t={34.25} width={1280} height={720} cam={{ pos: [0, 1.5, 6.3], target: [0, 1.45, 0], fov: 40 }} />
    <AbsoluteFill style={{ alignItems: "center", paddingTop: 18 }}>
      <PoppiloLogo startFrame={-100} size={110} />
    </AbsoluteFill>
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 26 }}>
      <div style={{ padding: "10px 30px", borderRadius: 999, background: "#ffffff", boxShadow: "0 6px 18px rgba(0,0,0,0.2)", fontFamily: "Fredoka", fontWeight: 700, fontSize: 52, color: "#ff5a7a" }}>
        The Little Animal Parade
      </div>
    </AbsoluteFill>
  </AbsoluteFill>
);
