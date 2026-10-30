import React from "react";
import { Asset, Motion } from "../engine/types";
import { CinematicBackdrop } from "../components/CinematicBackdrop";
import { Footage } from "../components/Footage";

/** A scene's visual: footage if one is set, otherwise the dark backdrop. */
export const Background: React.FC<{ slug: string; visual?: string; asset?: Asset; motion?: Motion; dim?: number; seed: string }> = ({
  slug,
  visual,
  asset,
  motion,
  dim,
  seed,
}) => (visual ? <Footage slug={slug} assetId={visual} asset={asset} motion={motion} dim={dim} compactSlate={(dim ?? 0) >= 0.5} /> : <CinematicBackdrop seed={seed} />);
