import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySignedSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";
import { isTeamAdmin } from "@/lib/admin";

export async function GET() {
  const cookieStore = await cookies();
  const signed = cookieStore.get("session")?.value;

  if (!signed) return NextResponse.json({ ok: true, is_admin: false });

  const session = verifySignedSession(signed);
  if (!session?.email) return NextResponse.json({ ok: true, is_admin: false });

  const { data, error } = await supabase
    .from("voters")
    .select("email, team:teams(name)")
    .eq("email", session.email)
    .single();

  if (error) {
    console.error("isAdminErr:", error);
    return NextResponse.json({ ok: true, is_admin: false });
  }

  // team può essere oggetto o array: gestiamo entrambi
  const teamField: any = (data as any)?.team;
  const teamName =
    Array.isArray(teamField) ? teamField?.[0]?.name ?? null : teamField?.name ?? null;

  return NextResponse.json({
    ok: true,
    is_admin: isTeamAdmin(teamName),
    team: teamName,
  });
}
