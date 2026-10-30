// Registry of documentary projects. `npm run new-project <slug>` adds entries here.
import { Cut, Fact, Asset, Project } from "../engine/types";

import chile33Project from "./chile-33/project.json";
import chile33Long from "./chile-33/long.json";
import chile33Short from "./chile-33/short.json";
import chile33Assets from "./chile-33/assets.json";
import chile33Facts from "./chile-33/facts.json";

export type ProjectBundle = {
  project: Project;
  cuts: Cut[];
  assets: Record<string, Asset>;
  facts: Fact[];
};

export const PROJECTS: ProjectBundle[] = [
  {
    project: chile33Project as Project,
    cuts: [chile33Long as Cut, chile33Short as Cut],
    assets: chile33Assets as Record<string, Asset>,
    facts: chile33Facts as Fact[],
  },
  // new-project:insert
];
