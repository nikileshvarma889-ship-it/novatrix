import { redirect } from "next/navigation";
import { requireUser } from "@/lib/supabase/server";
import { ProfileProvider, type Profile } from "@/hooks/useProfile";
import { AppShell } from "@/components/shell/AppShell";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireUser();
  if (!ctx) redirect("/login");
  const { supabase, user } = ctx;
  let { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  if (!profile) {
    // The signup trigger normally creates this; recover if it didn't.
    const { data } = await supabase.from("profiles").upsert({ id: user.id, full_name: (user.user_metadata?.full_name as string) ?? "" }).select("*").single();
    profile = data;
  }
  if (!profile) redirect("/login?error=" + encodeURIComponent("Your profile could not be loaded. Please check the database setup."));
  const { count } = await supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null);
  let avatarUrl: string | null = null;
  if (profile.avatar_path) {
    const { data } = await supabase.storage.from("user-files").createSignedUrl(profile.avatar_path, 60 * 60 * 6);
    avatarUrl = data?.signedUrl ?? null;
    // when Supabase is proxied through this origin, hand the browser a same-origin URL
    const pub = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    if (avatarUrl && pub.startsWith("/")) avatarUrl = avatarUrl.replace(/^https?:\/\/[^/]+/, pub);
  }
  return (
    <ProfileProvider initial={profile as Profile} email={user.email ?? ""} initialUnread={count ?? 0} initialAvatarUrl={avatarUrl}>
      <AppShell>{children}</AppShell>
    </ProfileProvider>
  );
}
