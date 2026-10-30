import React from "react";
import { AbsoluteFill } from "remotion";
import { PROJECTS } from "../projects";
import { CinematicBackdrop } from "../components/CinematicBackdrop";
import { Footage } from "../components/Footage";
import { FilmLook } from "../components/FilmLook";
import { ensureFonts } from "../fonts";
import { COLORS, FONTS } from "./theme";

ensureFonts();

/** 1280x720 YouTube thumbnail. Title words split on "." become stacked lines. */
export const Thumbnail: React.FC<{ slug: string; visual?: string }> = ({ slug, visual }) => {
  const bundle = PROJECTS.find((p) => p.project.slug === slug)!;
  const lines = bundle.project.title.split(".").map((s) => s.trim()).filter(Boolean);
  const asset = visual ? bundle.assets[visual] : undefined;
  return (
    <AbsoluteFill>
      {asset ? <Footage slug={slug} assetId={visual} asset={{ ...asset, label: "" }} motion="still" dim={0.35} /> : <CinematicBackdrop seed="thumb" />}
      <AbsoluteFill style={{ background: "linear-gradient(90deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 60%, transparent 100%)" }} />
      <AbsoluteFill style={{ justifyContent: "center", padding: "0 70px" }}>
        {lines.map((l, i) => (
          <div
            key={i}
            style={{
              fontFamily: FONTS.serif,
              fontWeight: 700,
              fontSize: 118,
              lineHeight: 0.98,
              color: i === lines.length - 1 ? COLORS.goldLight : COLORS.bone,
              textTransform: "uppercase",
              textShadow: "0 4px 24px rgba(0,0,0,0.9)",
            }}
          >
            {l}.
          </div>
        ))}
        <div style={{ marginTop: 30, fontFamily: FONTS.sans, fontWeight: 600, fontSize: 24, letterSpacing: "0.5em", color: COLORS.gold }}>THE UNTOLD</div>
      </AbsoluteFill>
      <FilmLook grain={0.06} />
    </AbsoluteFill>
  );
};
