import React from "react";
import { AbsoluteFill } from "remotion";
import { Asset } from "../engine/types";
import { SceneTiming } from "../engine/timeline";
import { BrandIntro } from "../brand/BrandIntro";
import { BrandOutro } from "../brand/BrandOutro";
import { Subtitles } from "../components/Subtitles";
import { SceneAudio } from "../components/SceneAudio";
import { FilmLook } from "../components/FilmLook";
import { TitleScene } from "./TitleScene";
import { ChapterScene } from "./ChapterScene";
import { FootageScene } from "./FootageScene";
import { DateScene } from "./DateScene";
import { StatScene } from "./StatScene";
import { QuoteScene } from "./QuoteScene";
import { DepthScene } from "./DepthScene";
import { TextScene } from "./TextScene";

/** Picks the visual for a scene type and layers subtitles, audio and the film look on top. */
export const SceneRenderer: React.FC<{ slug: string; timing: SceneTiming; assets: Record<string, Asset> }> = ({ slug, timing, assets }) => {
  const s = timing.scene;
  const asset = s.visual ? assets[s.visual] : undefined;
  const common = { slug, id: s.id, visual: s.visual, asset, motion: s.motion };

  let body: React.ReactNode;
  switch (s.type) {
    case "brand-intro":
      body = <BrandIntro />;
      break;
    case "brand-outro":
      body = <BrandOutro timing={timing} />;
      break;
    case "title":
      body = <TitleScene title={s.title} kicker={s.kicker} />;
      break;
    case "chapter":
      body = <ChapterScene number={s.number} title={s.title} />;
      break;
    case "footage":
      body = <FootageScene {...common} caption={s.caption} lowerThird={s.lowerThird} />;
      break;
    case "date":
      body = <DateScene {...common} date={s.date} place={s.place} detail={s.detail} />;
      break;
    case "stat":
      body = <StatScene {...common} value={s.value} unit={s.unit} label={s.label} />;
      break;
    case "quote":
      body = <QuoteScene {...common} quote={s.quote} translation={s.translation} attribution={s.attribution} />;
      break;
    case "depth":
      body = <DepthScene depthMeters={s.depthMeters} label={s.label} />;
      break;
    case "text":
      body = <TextScene id={s.id} lines={s.lines} sentences={timing.sentences} />;
      break;
  }

  return (
    <AbsoluteFill>
      {body}
      <FilmLook />
      <Subtitles cues={timing.cues} />
      <SceneAudio slug={slug} timing={timing} />
    </AbsoluteFill>
  );
};
