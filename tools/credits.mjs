#!/usr/bin/env node
// Writes out/<slug>/description.txt: sources, image credits and licenses,
// ready to paste into the YouTube description.
// Usage: node tools/credits.mjs <slug>
import fs from "node:fs";
import path from "node:path";
import { ROOT, listProjects, loadProject } from "./lib.mjs";

for (const slug of process.argv[2] ? [process.argv[2]] : listProjects()) {
  const { project, assets, facts } = loadProject(slug);
  const out = [];
  out.push(project.title, "");
  if (project.disclaimer) out.push(project.disclaimer, "");
  const sources = new Map();
  for (const f of facts) for (const s of f.sources ?? []) if (s.url) sources.set(s.url, s.title);
  out.push("SOURCES");
  for (const [url, title] of sources) out.push(`• ${title} — ${url}`);
  out.push("");
  const byKind = (k) => Object.values(assets).filter((a) => a.kind === k);
  const section = (title, list) => {
    if (!list.length) return;
    out.push(title);
    for (const a of list) out.push(`• ${a.description}${a.credit ? ` — ${a.credit}` : ""}${a.license ? ` (${a.license})` : ""}${a.sourceUrl ? ` ${a.sourceUrl}` : ""}`);
    out.push("");
  };
  section("ARCHIVAL IMAGES", byKind("archival"));
  section("REPRESENTATIVE FOOTAGE (does not show the actual event)", byKind("stock"));
  section("ILLUSTRATIONS", byKind("illustration"));
  section("DRAMATIZATIONS", byKind("reconstruction"));
  section("AI-GENERATED ILLUSTRATIONS", byKind("ai-generated"));
  if (project.voiceCredit) out.push("NARRATION", `• ${project.voiceCredit}`, "");
  out.push("THE UNTOLD — Some Stories Deserve to Be Heard.");
  const dir = path.join(ROOT, "out", slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "description.txt"), out.join("\n") + "\n");
  console.log(`Wrote out/${slug}/description.txt`);
}
