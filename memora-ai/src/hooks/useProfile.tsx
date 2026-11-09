"use client";
import React, { createContext, useCallback, useContext, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

export type Profile = {
  id: string; full_name: string; avatar_path: string | null; study_level: "inter1" | "inter2" | "eapcet";
  language_pref: "en" | "te" | "en_te"; explanation_style: string; timezone: string; theme: "dark" | "light" | "system";
  exam_name: string | null; exam_date: string | null; daily_goal_minutes: number; notify_in_app: boolean; notify_browser: boolean;
};
type Ctx = {
  profile: Profile; email: string; avatarUrl: string | null; setAvatarUrl: (u: string | null) => void;
  update: (p: Partial<Profile>) => Promise<{ error: string | null }>; unread: number; setUnread: (n: number) => void;
};
const ProfileCtx = createContext<Ctx | null>(null);

export function ProfileProvider({ initial, email, initialUnread, initialAvatarUrl, children }: { initial: Profile; email: string; initialUnread: number; initialAvatarUrl: string | null; children: React.ReactNode }) {
  const [profile, setProfile] = useState(initial);
  const [unread, setUnread] = useState(initialUnread);
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl);
  const update = useCallback(async (p: Partial<Profile>) => {
    const { error } = await supabaseBrowser().from("profiles").update(p).eq("id", initial.id);
    if (!error) setProfile((x) => ({ ...x, ...p }));
    return { error: error?.message ?? null };
  }, [initial.id]);
  return <ProfileCtx.Provider value={{ profile, email, update, unread, setUnread, avatarUrl, setAvatarUrl }}>{children}</ProfileCtx.Provider>;
}
export function useProfile() {
  const c = useContext(ProfileCtx);
  if (!c) throw new Error("useProfile must be used inside ProfileProvider");
  return c;
}
