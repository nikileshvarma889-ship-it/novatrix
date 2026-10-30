import React from "react";
import { Loop, OffthreadVideo, staticFile } from "remotion";
import { Tool } from "../content/tools";
import { bodyFont } from "../fonts";
import { DemoPlaceholder } from "./DemoPlaceholder";
import { SHOW_PLACEHOLDER_HINTS } from "../config";

/**
 * Browser window that shows your screen recording (public/clips/<tool>.mp4)
 * or an animated mock-up of the tool when no recording has been added.
 */
export const BrowserFrame: React.FC<{
  tool: Tool;
  clip: { file: string; frames: number } | null;
  width: number;
  height: number;
}> = ({ tool, clip, width, height }) => {
  const bar = 54;
  return (
    <div
      style={{
        width,
        height,
        borderRadius: 22,
        overflow: "hidden",
        background: "#0b0e1c",
        border: "1px solid rgba(255,255,255,0.14)",
        boxShadow: `0 40px 120px rgba(0,0,0,0.65), 0 0 80px ${tool.accent}33`,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          height: bar,
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "0 20px",
          background: "linear-gradient(180deg, #1a1f36, #141829)",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
          <div key={c} style={{ width: 14, height: 14, borderRadius: 7, background: c }} />
        ))}
        <div
          style={{
            marginLeft: 22,
            flex: 1,
            height: 32,
            borderRadius: 16,
            background: "rgba(255,255,255,0.07)",
            display: "flex",
            alignItems: "center",
            padding: "0 18px",
            fontFamily: bodyFont,
            fontSize: 18,
            color: "#c7cde6",
          }}
        >
          <span style={{ color: "#6ee7b7", marginRight: 10 }}>●</span>
          https://{tool.url}
        </div>
      </div>
      <div style={{ position: "relative", flex: 1, overflow: "hidden" }}>
        {clip ? (
          <Loop durationInFrames={clip.frames}>
            <OffthreadVideo
              src={staticFile(clip.file)}
              muted
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </Loop>
        ) : (
          <>
            <DemoPlaceholder tool={tool} width={width} height={height - bar} />
            {SHOW_PLACEHOLDER_HINTS ? (
              <div
                style={{
                  position: "absolute",
                  right: 16,
                  bottom: 16,
                  padding: "8px 14px",
                  borderRadius: 10,
                  background: "rgba(0,0,0,0.6)",
                  border: "1px dashed rgba(255,255,255,0.35)",
                  fontFamily: bodyFont,
                  fontSize: 15,
                  color: "#e5e7eb",
                }}
              >
                ▶ Screen recording placeholder · public/clips/{tool.id}.mp4
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
};
