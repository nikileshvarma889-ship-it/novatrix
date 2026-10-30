#!/usr/bin/env node
// One command to produce a film:
//   scan media → check project → render each cut → thumbnail → credits.
// Usage: npm run render -- <slug> [long|short|all] [--draft] [--strict]
//   --draft   half resolution, faster, for review
//   --strict  refuse to render if any fact is not verified (use for publishing)
import fs from "node:fs";
import path from "node:path";
import { ROOT, listProjects, loadProject, run } from "./lib.mjs";

const args = process.argv.slice(2);
const flags = args.filter((a) => a.startsWith("--"));
const [slug, which = "all"] = args.filter((a) => !a.startsWith("--"));
if (!slug || !listProjects().includes(slug)) {
  console.error(`Usage: npm run render -- <slug> [long|short|all] [--draft] [--strict]\nProjects: ${listProjects().join(", ")}`);
  process.exit(1);
}
const draft = flags.includes("--draft");
run("node", ["tools/scan-media.mjs"]);
run("node", ["tools/check-project.mjs", slug, ...(flags.includes("--strict") ? ["--strict"] : [])]);

const { cuts } = loadProject(slug);
const outDir = path.join(ROOT, "out", slug);
fs.mkdirSync(outDir, { recursive: true });
for (const cut of cuts.filter((c) => which === "all" || c.id === which)) {
  const out = path.join("out", slug, `${slug}-${cut.id}${draft ? "-draft" : ""}.mp4`);
  const extra = draft ? ["--scale=0.5", "--crf=26"] : ["--crf=18"];
  run("npx", ["remotion", "render", `${slug}-${cut.id}`, out, ...extra]);
  console.log(`✔ ${out}`);
}
run("npx", ["remotion", "still", `${slug}-thumbnail`, path.join("out", slug, `${slug}-thumbnail.png`)]);
run("node", ["tools/credits.mjs", slug]);
