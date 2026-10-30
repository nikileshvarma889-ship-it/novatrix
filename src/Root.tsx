import React from "react";
import { Composition, Still } from "remotion";
import { VIDEO } from "./config";
import { PROJECTS } from "./projects";
import { Documentary, DocumentaryProps, getCut } from "./engine/Documentary";
import { Thumbnail } from "./brand/Thumbnail";

/**
 * One composition per project and cut, e.g. "chile-33-long" (16:9) and
 * "chile-33-short" (9:16), plus "<slug>-thumbnail".
 */
export const RemotionRoot: React.FC = () => (
  <>
    {PROJECTS.map(({ project, cuts }) => (
      <React.Fragment key={project.slug}>
        {cuts.map((cut) => {
          const size = VIDEO.formats[cut.format];
          const props: DocumentaryProps = { slug: project.slug, cutId: cut.id };
          return (
            <Composition
              key={cut.id}
              id={`${project.slug}-${cut.id}`}
              component={Documentary}
              defaultProps={props}
              durationInFrames={getCut(project.slug, cut.id).timing.totalFrames}
              fps={VIDEO.fps}
              width={size.width}
              height={size.height}
            />
          );
        })}
        <Still
          id={`${project.slug}-thumbnail`}
          component={Thumbnail}
          defaultProps={{ slug: project.slug, visual: undefined as string | undefined }}
          width={1280}
          height={720}
        />
      </React.Fragment>
    ))}
  </>
);
