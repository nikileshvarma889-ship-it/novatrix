import React from "react";
import { interpolate, random, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Tool } from "../content/tools";
import { bodyFont, displayFont } from "../fonts";

const clamp = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };

const Lines: React.FC<{ n: number; start: number; color: string; widths?: number[] }> = ({ n, start, color, widths }) => {
  const frame = useCurrentFrame();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {new Array(n).fill(0).map((_, i) => {
        const p = interpolate(frame, [start + i * 6, start + i * 6 + 14], [0, 1], clamp);
        const w = widths?.[i] ?? 60 + random(`w${i}${color}`) * 38;
        return (
          <div
            key={i}
            style={{
              height: 14,
              width: `${w * p}%`,
              borderRadius: 7,
              background: `linear-gradient(90deg, ${color}aa, ${color}33)`,
            }}
          />
        );
      })}
    </div>
  );
};

/** Animated mock-up of each tool, used until you drop in a real screen recording. */
export const DemoPlaceholder: React.FC<{ tool: Tool; width: number; height: number }> = ({ tool, width, height }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const typed = Math.floor(interpolate(frame, [20, 20 + tool.prompt.length * 1.2], [0, tool.prompt.length], clamp));
  const caret = Math.floor(frame / 15) % 2 === 0;
  const resultStart = 30 + Math.round(tool.prompt.length * 1.2);
  const a = tool.accent;

  let body: React.ReactNode = null;
  switch (tool.demo) {
    case "chat":
      body = (
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div style={{ display: "flex", gap: 16 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: `${a}55`, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <Lines n={4} start={resultStart} color={a} widths={[92, 86, 95, 60]} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 16 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: `${a}55`, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <Lines n={3} start={resultStart + 40} color={tool.accent2} widths={[80, 90, 45]} />
            </div>
          </div>
        </div>
      );
      break;
    case "search":
      body = (
        <div>
          <div style={{ display: "flex", gap: 12, marginBottom: 22 }}>
            {[1, 2, 3, 4].map((i) => {
              const p = spring({ frame: frame - resultStart - i * 5, fps, config: { damping: 14 } });
              return (
                <div
                  key={i}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 10,
                    background: `${a}22`,
                    border: `1px solid ${a}66`,
                    color: "#e6fffb",
                    fontFamily: bodyFont,
                    fontSize: 16,
                    transform: `scale(${p})`,
                  }}
                >
                  [{i}] source
                </div>
              );
            })}
          </div>
          <Lines n={6} start={resultStart + 25} color={a} />
        </div>
      );
      break;
    case "slides":
      body = (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 18 }}>
          {new Array(6).fill(0).map((_, i) => {
            const p = spring({ frame: frame - resultStart - i * 7, fps, config: { damping: 13 } });
            return (
              <div
                key={i}
                style={{
                  aspectRatio: "16/9",
                  borderRadius: 12,
                  padding: 14,
                  background: `linear-gradient(135deg, ${i % 2 ? a : tool.accent2}66, #1a1530)`,
                  border: "1px solid rgba(255,255,255,0.15)",
                  transform: `scale(${p}) rotate(${(1 - p) * 8}deg)`,
                  opacity: p,
                }}
              >
                <div style={{ height: 10, width: "70%", borderRadius: 5, background: "#ffffffcc", marginBottom: 8 }} />
                <div style={{ height: 7, width: "50%", borderRadius: 4, background: "#ffffff77" }} />
              </div>
            );
          })}
        </div>
      );
      break;
    case "images":
      body = (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
          {new Array(8).fill(0).map((_, i) => {
            const p = interpolate(frame, [resultStart + i * 6, resultStart + i * 6 + 24], [0, 1], clamp);
            const hue = Math.round(random(`img${i}`) * 360);
            return (
              <div
                key={i}
                style={{
                  aspectRatio: "1",
                  borderRadius: 12,
                  background: `radial-gradient(circle at ${30 + i * 7}% 30%, hsl(${hue} 90% 70%), hsl(${(hue + 60) % 360} 70% 35%) 60%, #0b0e1c)`,
                  filter: `blur(${(1 - p) * 16}px) saturate(${0.3 + p * 0.9})`,
                  opacity: 0.25 + p * 0.75,
                }}
              />
            );
          })}
        </div>
      );
      break;
    case "voice":
    case "music": {
      const bars = 64;
      const on = interpolate(frame, [resultStart, resultStart + 12], [0, 1], clamp);
      body = (
        <div>
          {tool.demo === "music" ? (
            <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
              {["Midnight Code", "Neon Loops"].map((t, i) => (
                <div
                  key={t}
                  style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    padding: 14,
                    borderRadius: 14,
                    background: "rgba(255,255,255,0.06)",
                    opacity: interpolate(frame, [resultStart + i * 10, resultStart + i * 10 + 12], [0, 1], clamp),
                  }}
                >
                  <div style={{ width: 64, height: 64, borderRadius: 10, background: `linear-gradient(135deg, ${a}, ${tool.accent2})` }} />
                  <div style={{ fontFamily: displayFont, fontWeight: 700, fontSize: 22, color: "#fff" }}>{t}</div>
                </div>
              ))}
            </div>
          ) : null}
          <div style={{ display: "flex", alignItems: "center", gap: 5, height: 200 }}>
            {new Array(bars).fill(0).map((_, i) => {
              const h =
                12 +
                on *
                  (Math.abs(Math.sin(frame / 4 + i * 0.55)) * 70 + Math.abs(Math.sin(frame / 9 + i * 0.21)) * 90) *
                  (0.5 + random(`bar${i}`) * 0.5);
              return (
                <div
                  key={i}
                  style={{
                    flex: 1,
                    height: h,
                    borderRadius: 4,
                    background: `linear-gradient(180deg, ${tool.accent2}, ${a})`,
                  }}
                />
              );
            })}
          </div>
        </div>
      );
      break;
    }
    case "design": {
      const p = (d: number) => spring({ frame: frame - resultStart - d, fps, config: { damping: 12 } });
      body = (
        <div
          style={{
            position: "relative",
            height: 300,
            borderRadius: 16,
            overflow: "hidden",
            background: `linear-gradient(135deg, ${tool.accent2}, #120a2e 70%)`,
            transform: `scale(${0.85 + 0.15 * p(0)})`,
            opacity: p(0),
          }}
        >
          <div
            style={{
              position: "absolute",
              left: 40,
              top: 50,
              fontFamily: displayFont,
              fontWeight: 700,
              fontSize: 72,
              lineHeight: 1,
              color: "#fff",
              transform: `translateX(${(1 - p(10)) * -300}px)`,
            }}
          >
            7 FREE
            <br />
            <span style={{ color: a }}>AI TOOLS</span>
          </div>
          <div
            style={{
              position: "absolute",
              right: 50,
              top: 40,
              width: 210,
              height: 210,
              borderRadius: "50%",
              background: `radial-gradient(circle at 35% 35%, #fff, ${a} 45%, #0b2240)`,
              transform: `scale(${p(20)})`,
              boxShadow: `0 0 60px ${a}`,
            }}
          />
        </div>
      );
      break;
    }
  }

  return (
    <div
      style={{
        width,
        height,
        padding: "34px 44px",
        background: `radial-gradient(ellipse at 80% 0%, ${a}22, transparent 60%), #0b0e1c`,
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: "18px 22px",
          marginBottom: 30,
          borderRadius: 16,
          background: "rgba(255,255,255,0.06)",
          border: `1px solid ${a}55`,
          fontFamily: bodyFont,
          fontSize: 24,
          color: "#fff",
        }}
      >
        <span style={{ color: a, fontWeight: 800 }}>›</span>
        <span>
          {tool.prompt.slice(0, typed)}
          <span style={{ opacity: caret ? 1 : 0, color: a }}>|</span>
        </span>
      </div>
      {body}
    </div>
  );
};
