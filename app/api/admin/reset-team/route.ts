import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { isAdminRequest } from "@/lib/admin-auth";

export async function POST(req: Request) {
  const auth = await isAdminRequest(req);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const team_id = Number(body.team_id);

  if (!team_id) {
    return NextResponse.json({ ok: false, error: "team_id required" }, { status: 400 });
  }

  // 1) set has_voted = false
  const { error: e1 } = await supabase
    .from("teams")
    .update({ has_voted: false })
    .eq("id", team_id);

  if (e1) {
    console.error("resetTeamErr:", e1);
    return NextResponse.json({ ok: false, error: "DB error (teams)" }, { status: 500 });
  }

  // 2) elimina voto squadra (così può rivotare)
  const { error: e2 } = await supabase.from("votes").delete().eq("team_id", team_id);

  if (e2) {
    console.error("resetVotesErr:", e2);
    return NextResponse.json({ ok: false, error: "DB error (votes)" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, reset_team_id: team_id });
}
