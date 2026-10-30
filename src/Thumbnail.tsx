import React from "react";
import { AbsoluteFill } from "remotion";
import { BRAND } from "./config";
import { TOOLS } from "./content/tools";
import { TechBackground } from "./components/TechBackground";
import { CategoryIcon } from "./components/Icons";
import { displayFont, ensureFonts } from "./fonts";

ensureFonts();

/** 1280x720 YouTube thumbnail: `npm run thumbnail`. */
export const Thumbnail: React.FC = () => (
  <AbsoluteFill>
    <TechBackground seed="thumb" particles={40} />
    <AbsoluteFill style={{ padding: "60px 70px", justifyContent: "center" }}>
      <div style={{ fontFamily: displayFont, fontWeight: 700, lineHeight: 0.95, color: "#fff", textShadow: "0 6px 30px rgba(0,0,0,0.8)" }}>
        <div style={{ fontSize: 210, color: BRAND.secondary }}>
          7 <span style={{ color: "#fff" }}>FREE</span>
        </div>
        <div style={{ fontSize: 130 }}>AI TOOLS</div>
        <div
          style={{
            display: "inline-block",
            marginTop: 26,
            padding: "8px 26px",
            fontSize: 70,
            background: BRAND.hot,
            transform: "rotate(-3deg)",
            boxShadow: `0 0 50px ${BRAND.hot}`,
          }}
        >
          FEEL ILLEGAL
        </div>
      </div>
    </AbsoluteFill>
    <div style={{ position: "absolute", right: 60, top: 70, display: "grid", gridTemplateColumns: "repeat(2, 130px)", gap: 22 }}>
      {TOOLS.slice(0, 6).map((t) => (
        <div
          key={t.id}
          style={{
            width: 130,
            height: 130,
            borderRadius: 30,
            background: "rgba(10,12,30,0.85)",
            border: `3px solid ${t.accent}`,
            boxShadow: `0 0 30px ${t.accent}88`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <CategoryIcon kind={t.demo} size={76} color={t.accent} />
        </div>
      ))}
    </div>
    <div style={{ position: "absolute", right: 70, bottom: 40, fontFamily: displayFont, fontWeight: 700, fontSize: 40, letterSpacing: "0.2em", color: "#fff" }}>
      2026
    </div>
  </AbsoluteFill>
);
