#!/usr/bin/env node
// Scaffolds a new documentary: src/projects/<slug>/ with project, cuts,
// assets and facts JSON, the public/ media folders, and a registry entry.
// Usage: npm run new-project -- <slug> "Title Of The Film"
import fs from "node:fs";
import path from "node:path";
import { PROJECTS_SRC, PUBLIC } from "./lib.mjs";

const [slug, title = "Untitled Story"] = process.argv.slice(2);
if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
  console.error('Usage: npm run new-project -- <slug-in-kebab-case> "Title"');
  process.exit(1);
}
const dir = path.join(PROJECTS_SRC, slug);
if (fs.existsSync(dir)) {
  console.error(`src/projects/${slug} already exists.`);
  process.exit(1);
}
const write = (f, o) => fs.writeFileSync(path.join(dir, f), JSON.stringify(o, null, 2) + "\n");
fs.mkdirSync(dir, { recursive: true });
write("project.json", { slug, title, category: "true-story", narrationLanguage: "en", subtitleLanguage: "en", disclaimer: "Archival material is credited on screen. Representative footage and illustrations are labelled." });
write("facts.json", [{ id: "F01", claim: "First fact the story relies on.", status: "needs-source", sources: [] }]);
write("assets.json", { "opening-shot": { file: "opening-shot.mp4", kind: "stock", description: "Describe the shot you need", license: "" } });
const scenes = (format) => [
  { id: "intro", type: "brand-intro", minSeconds: format === "landscape" ? 7 : 3, transition: "dip-to-black", sfx: [{ id: "riser", at: 0 }, { id: "impact", at: 2.6 }] },
  { id: "title", type: "title", title: title.split(/(?<=\.)\s+/), minSeconds: 5, transition: "dip-to-black" },
  { id: "scene-01", type: "footage", visual: "opening-shot", motion: "push-in", facts: ["F01"], narration: [{ say: "First line of narration." }] },
  { id: "outro", type: "brand-outro", tail: format === "landscape" ? 8 : 2, transition: "fade" },
];
write("long.json", { id: "long", format: "landscape", title, scenes: scenes("landscape") });
write("short.json", { id: "short", format: "vertical", title: `${title} (Short)`, scenes: scenes("vertical") });
for (const sub of ["voiceover/long", "voiceover/short", "footage", "music", "sfx"]) fs.mkdirSync(path.join(PUBLIC, "projects", slug, sub), { recursive: true });

// Register in src/projects/index.ts
const indexPath = path.join(PROJECTS_SRC, "index.ts");
const id = slug.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase()).replace(/^[0-9]/, (c) => `p${c}`);
let index = fs.readFileSync(indexPath, "utf8");
const imports = ["Project", "Long", "Short", "Assets", "Facts"]
  .map((k) => `import ${id}${k} from "./${slug}/${k === "Project" ? "project" : k.toLowerCase()}.json";`)
  .join("\n");
index = index.replace("\nexport type ProjectBundle", `\n${imports}\n\nexport type ProjectBundle`);
index = index.replace(
  "  // new-project:insert",
  `  {\n    project: ${id}Project as unknown as Project,\n    cuts: [${id}Long as unknown as Cut, ${id}Short as unknown as Cut],\n    assets: ${id}Assets as unknown as Record<string, Asset>,\n    facts: ${id}Facts as unknown as Fact[],\n  },\n  // new-project:insert`,
);
fs.writeFileSync(indexPath, index);
console.log(`Created src/projects/${slug}/ and public/projects/${slug}/. Compositions: ${slug}-long, ${slug}-short`);
