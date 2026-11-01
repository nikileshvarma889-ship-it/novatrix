import { redirect } from "next/navigation";
import { currentUser } from "@/lib/session";
import { Shell } from "@/components/Shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (!(await currentUser())) redirect("/login");
  return <Shell>{children}</Shell>;
}
