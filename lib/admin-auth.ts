import { cookies } from "next/headers";
import { verifySignedSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";
import { isTeamAdmin } from "@/lib/admin";

export async function isAdminRequest(req: Request) {
  // 1) Password in query
  const url = new URL(req.url);
  const qp = url.searchParams.get("admin_password");

  if (qp && qp === process.env.ADMIN_PASSWORD) {
    return { ok: true as const, by: "password" as const };
  }

  // 2) Session cookie + whitelist team
  const cookieStore = await cookies();
  const signed = cookieStore.get("session")?.value;
  if (!signed) return { ok: false as const };

  const session = verifySignedSession(signed) as { email?: string } | null;
  if (!session?.email) return { ok: false as const };

  const { data } = await supabase
    .from("voters")
    .select("team:teams(name)")
    .eq("email", session.email)
    .single();

  const teamField: any = (data as any)?.team;
  const teamName =
    Array.isArray(teamField) ? teamField?.[0]?.name ?? null : teamField?.name ?? null;

  if (!isTeamAdmin(teamName)) return { ok: false as const };

  return { ok: true as const, by: "team" as const, team: teamName };
}
