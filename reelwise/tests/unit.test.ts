import { describe, expect, it, beforeAll } from "vitest";
import crypto from "node:crypto";

beforeAll(() => {
  process.env.ENCRYPTION_KEY ??= crypto.randomBytes(32).toString("base64");
  process.env.DATABASE_URL ??= "postgres://x@localhost/x";
});

describe("crypto", () => {
  it("round-trips and never stores plaintext", async () => {
    const { encrypt, decrypt } = await import("../src/lib/crypto");
    const blob = encrypt("EAAB-secret-token");
    expect(blob).not.toContain("secret");
    expect(decrypt(blob)).toBe("EAAB-secret-token");
  });
  it("detects tampering", async () => {
    const { encrypt, decrypt } = await import("../src/lib/crypto");
    const [v, iv, tag, data] = encrypt("hello").split(":");
    const flipped = Buffer.from(data, "base64");
    flipped[0] ^= 1;
    expect(() => decrypt([v, iv, tag, flipped.toString("base64")].join(":"))).toThrow();
  });
});

describe("upload sniffing", () => {
  it("identifies real types by signature, not name", async () => {
    const { sniff } = await import("../src/lib/storage");
    expect(sniff(Buffer.from("89504e470d0a1a0a0000", "hex"))).toBe("image/png");
    expect(sniff(Buffer.from("ffd8ffe000", "hex"))).toBe("image/jpeg");
    expect(sniff(Buffer.from("000000186674797069736f6d", "hex"))).toBe("video/mp4");
    expect(sniff(Buffer.from("#!/bin/sh\nrm -rf /"))).toBeNull();
  });
});

describe("subtitles", () => {
  it("splits narration into timed cues covering the clip", async () => {
    const { buildCues } = await import("../worker/render");
    const cues = buildCues("one two three four five six seven eight nine ten", 10, 4, 5);
    expect(cues).toHaveLength(2);
    expect(cues[0].from).toBe(10);
    expect(cues[1].to).toBeCloseTo(14, 5);
  });
});

describe("autopilot scheduling", () => {
  it("picks the next HH:MM slot at least 2h away", async () => {
    const { nextSlot } = await import("../worker/tasks");
    const from = new Date(Date.UTC(2026, 0, 5, 9, 0));
    expect(nextSlot(["10:00", "18:30"], 2, from).toISOString()).toBe("2026-01-05T18:30:00.000Z");
    expect(nextSlot(["08:00"], 2, from).toISOString()).toBe("2026-01-06T08:00:00.000Z");
  });
});

describe("platform errors", () => {
  it("explains Meta permission and expiry errors", async () => {
    const { explainMetaError } = await import("../src/lib/social/meta");
    expect(explainMetaError({ code: 190, message: "expired" }).expired).toBe(true);
    expect(explainMetaError({ code: 10, message: "(#10) Application does not have permission" }).msg).toMatch(/App Review/);
  });
});

describe("Telugu voice rule", () => {
  it("detects Telugu by language name or script", async () => {
    const { isTelugu, TELUGU_VOICE } = await import("../src/lib/voices");
    expect(TELUGU_VOICE).toBe("Bunty");
    expect(isTelugu("Telugu")).toBe(true);
    expect(isTelugu("మీ పార్సెల్ సురక్షితంగా")).toBe(true);
    expect(isTelugu("English", "Your parcel is safe")).toBe(false);
  });
});

describe("approval schema", () => {
  it("requires explicit confirmation and at least one account", async () => {
    const { z } = await import("zod/v4");
    const Approve = z.object({ accountIds: z.array(z.uuid()).min(1), scheduleAt: z.iso.datetime().nullable(), confirm: z.literal(true) });
    expect(Approve.safeParse({ accountIds: [crypto.randomUUID()], scheduleAt: null }).success).toBe(false);
    expect(Approve.safeParse({ accountIds: [], scheduleAt: null, confirm: true }).success).toBe(false);
    expect(Approve.safeParse({ accountIds: [crypto.randomUUID()], scheduleAt: null, confirm: true }).success).toBe(true);
  });
});

import { pgConnection } from "../src/lib/db-url";
describe("database URL", () => {
  it("strips libpq-only params and detects poolers", () => {
    const neon = pgConnection("postgresql://u:p@ep-cool-1-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require");
    expect(neon.url).toBe("postgresql://u:p@ep-cool-1-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require");
    expect(neon.prepare).toBe(false);
    expect(pgConnection("postgres://u:p@localhost:5432/db").prepare).toBe(true);
  });
});
