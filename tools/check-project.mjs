#!/usr/bin/env node
// Validates a project before rendering:
//   • every scene is well-formed and every visual exists in assets.json
//   • every asset says where it came from and under what license
//   • reconstructions / AI imagery can never have their label hidden
//   • narration only relies on facts that are verified (warns otherwise;
//     --strict makes unverified facts an error — use it before publishing)
//   • lists the voiceover and footage files still missing
// Usage: node tools/check-project.mjs [slug] [--strict]
import fs from "node:fs";
import path from "node:path";
import { PUBLIC, listProjects, loadProject } from "./lib.mjs";

const args = process.argv.slice(2);
const strict = args.includes("--strict");
const slugs = args.filter((a) => !a.startsWith("--"));
const TYPES = {
  "brand-intro": [], "brand-outro": [], title: ["title"], chapter: ["number", "title"], footage: [],
  date: ["date"], stat: ["value", "label"], quote: ["quote", "attribution"], depth: ["depthMeters", "label"], text: ["lines"],
};
const TRANSITIONS = ["cut", "fade", "dip-to-black", "slow-dissolve", "slide-up"];
const KINDS = ["archival", "stock", "illustration", "reconstruction", "ai-generated"];
let failed = false;

for (const slug of slugs.length ? slugs : listProjects()) {
  const { project, assets, facts, cuts } = loadProject(slug);
  const errors = [];
  const warnings = [];
  const missingFootage = new Set();
  const factIds = new Map(facts.map((f) => [f.id, f]));
  const translated = project.narrationLanguage !== project.subtitleLanguage;

  for (const [id, a] of Object.entries(assets)) {
    if (!a.file || !a.kind || !a.description) errors.push(`asset ${id}: needs file, kind and description`);
    if (a.kind && !KINDS.includes(a.kind)) errors.push(`asset ${id}: unknown kind "${a.kind}"`);
    if (["archival", "stock"].includes(a.kind) && !a.license) errors.push(`asset ${id}: ${a.kind} footage needs a license`);
    if (a.kind === "archival" && !a.credit) errors.push(`asset ${id}: archival footage needs a credit`);
    if (/UNVERIFIED/i.test(a.license ?? "") || /unknown/i.test(a.credit ?? ""))
      (strict ? errors : warnings).push(`asset ${id}: source/license not verified yet — ${a.file}`);
    if (["reconstruction", "ai-generated"].includes(a.kind) && a.label === "")
      errors.push(`asset ${id}: ${a.kind} imagery must stay labelled on screen`);
    if (!fs.existsSync(path.join(PUBLIC, "projects", slug, "footage", a.file))) missingFootage.add(`${a.file}  (${a.kind}: ${a.description})`);
  }

  for (const cut of cuts) {
    if (!["landscape", "vertical"].includes(cut.format)) errors.push(`${cut.id}: format must be landscape or vertical`);
    const seen = new Set();
    const missingVo = [];
    for (const s of cut.scenes) {
      const where = `${cut.id}/${s.id}`;
      if (seen.has(s.id)) errors.push(`${where}: duplicate scene id`);
      seen.add(s.id);
      if (!TYPES[s.type]) {
        errors.push(`${where}: unknown type "${s.type}"`);
        continue;
      }
      for (const field of TYPES[s.type]) if (s[field] === undefined) errors.push(`${where}: "${s.type}" needs "${field}"`);
      if (s.transition && !TRANSITIONS.includes(s.transition)) errors.push(`${where}: unknown transition "${s.transition}"`);
      if (s.visual && !assets[s.visual]) errors.push(`${where}: visual "${s.visual}" is not in assets.json`);
      for (const [i, l] of (s.narration ?? []).entries()) {
        if (!l.say) errors.push(`${where}: narration line ${i + 1} has no "say" text`);
        if (translated && !l.sub) errors.push(`${where}: narration line ${i + 1} needs a "${project.subtitleLanguage}" subtitle ("sub")`);
      }
      for (const fid of s.facts ?? []) {
        const f = factIds.get(fid);
        if (!f) errors.push(`${where}: fact ${fid} is not in facts.json`);
        else if (f.status === "disputed") errors.push(`${where}: relies on disputed fact ${fid}`);
        else if (f.status !== "verified") (strict ? errors : warnings).push(`${where}: fact ${fid} still ${f.status} — "${f.claim}"`);
      }
      const voDir = path.join(PUBLIC, "projects", slug, "voiceover", cut.id);
      if (s.narration?.length && !fs.readdirSync(voDir, { withFileTypes: true }).some((d) => d.name.startsWith(`${s.id}.`)))
        missingVo.push(s.id);
    }
    if (missingVo.length) warnings.push(`${cut.id}: no voiceover yet for ${missingVo.length} scene(s): ${missingVo.join(", ")}`);
  }
  for (const f of facts) if (f.status === "verified" && !f.sources?.length) errors.push(`fact ${f.id}: marked verified but has no source`);

  console.log(`\n■ ${slug} — ${project.title}`);
  for (const e of errors) console.log(`  ✖ ${e}`);
  for (const w of warnings) console.log(`  ! ${w}`);
  if (missingFootage.size) {
    console.log(`  ! ${missingFootage.size} footage file(s) not added yet (slates will show instead):`);
    for (const m of missingFootage) console.log(`      public/projects/${slug}/footage/${m}`);
  }
  if (!errors.length) console.log(`  ✔ no blocking errors${strict ? " (strict)" : ""}`);
  failed ||= errors.length > 0;
}
process.exit(failed ? 1 : 0);
