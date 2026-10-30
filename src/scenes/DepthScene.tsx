import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, FONTS } from "../brand/theme";
import { useFormat } from "../engine/format";
import { PROVENANCE_LABELS } from "../config";
import { progress, reveal } from "./anim";

/** Labelled cross-section illustration showing how deep something is. */
export const DepthScene: React.FC<{ depthMeters: number; label: string }> = ({ depthMeters, label }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const { vertical, width, height, u } = useFormat();
  const p = progress(frame, 15, Math.min(durationInFrames - 20, 110));
  const top = (vertical ? 380 : 210) * u;
  const bottom = height - (vertical ? 700 : 330) * u;
  const x = vertical ? width / 2 : width * 0.56;
  const y = top + (bottom - top) * p;
  const step = depthMeters >= 500 ? 100 : 50;
  const ticks = Math.floor(depthMeters / step);

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.black }}>
      {/* Surface and rock strata */}
      <div style={{ position: "absolute", left: 0, right: 0, top, bottom: 0, background: `linear-gradient(180deg, #2a241c 0%, #1b1916 25%, #141312 60%, #0c0c0c 100%)` }} />
      {[0.18, 0.37, 0.55, 0.76].map((t, i) => (
        <div key={i} style={{ position: "absolute", left: 0, right: 0, top: top + (bottom - top) * t, height: 1, background: "rgba(184,154,94,0.12)" }} />
      ))}
      <div style={{ position: "absolute", left: 0, right: 0, top: top - 1, height: 2, background: COLORS.goldDeep }} />
      <div style={{ position: "absolute", left: x - 90 * u, top: top - 34 * u, fontFamily: FONTS.sans, fontSize: 18 * u, letterSpacing: "0.3em", color: COLORS.ash }}>SURFACE</div>

      {/* Scale */}
      {new Array(ticks + 1).fill(0).map((_, i) => {
        const ty = top + ((bottom - top) * (i * step)) / depthMeters;
        return (
          <div key={i} style={{ position: "absolute", left: x - 230 * u, top: ty - 10 * u, display: "flex", alignItems: "center", gap: 10 * u, opacity: 0.6 }}>
            <span style={{ width: 70 * u, textAlign: "right", fontFamily: FONTS.sans, fontSize: 16 * u, color: COLORS.ash }}>{i * step} m</span>
            <span style={{ width: 24 * u, height: 1, background: COLORS.ash }} />
          </div>
        );
      })}

      {/* Shaft being traced */}
      <div style={{ position: "absolute", left: x - 1, top, width: 2, height: y - top, background: `linear-gradient(180deg, ${COLORS.goldDeep}, ${COLORS.goldLight})` }} />
      <div style={{ position: "absolute", left: x - 9 * u, top: y - 9 * u, width: 18 * u, height: 18 * u, borderRadius: "50%", background: COLORS.goldLight, boxShadow: `0 0 ${24 * u}px ${COLORS.gold}` }} />

      {/* Readout */}
      <div style={{ position: "absolute", left: x + 50 * u, top: y - 70 * u }}>
        <div style={{ fontFamily: FONTS.serif, fontWeight: 600, fontSize: 110 * u, lineHeight: 1, color: COLORS.bone }}>
          {Math.round(depthMeters * p)}
          <span style={{ fontSize: "0.4em", color: COLORS.gold, marginLeft: 10 * u }}>m</span>
        </div>
        <div style={{ ...reveal(frame, 100), maxWidth: 420 * u, fontFamily: FONTS.serif, fontStyle: "italic", fontSize: 28 * u, color: COLORS.ash }}>{label}</div>
      </div>

      <div style={{ position: "absolute", top: (vertical ? 150 : 48) * u, left: (vertical ? 60 : 64) * u, fontFamily: FONTS.sans, fontWeight: 600, fontSize: (vertical ? 22 : 17) * u, letterSpacing: "0.16em", textTransform: "uppercase", color: COLORS.bone, opacity: 0.8 }}>
        {PROVENANCE_LABELS.illustration} · not to scale horizontally
      </div>
    </AbsoluteFill>
  );
};
