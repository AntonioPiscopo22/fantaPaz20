import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabase } from "@/lib/supabase";
import { verifySignedSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const raw = cookieStore.get("session")?.value;

  if (!raw) {
    return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });
  }

  const session = verifySignedSession(raw);
  const team_id = Number(session?.team_id);

  if (!team_id) {
    return NextResponse.json({ ok: false, error: "Invalid session" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const option_id = Number(body.option_id);

  if (!option_id || Number.isNaN(option_id)) {
    return NextResponse.json({ ok: false, error: "option_id required" }, { status: 400 });
  }

  // 1) controlla se la squadra ha già votato
  const { data: teamRow, error: teamErr } = await supabase
    .from("teams")
    .select("id, has_voted")
    .eq("id", team_id)
    .single();

  if (teamErr || !teamRow) {
    console.error("voteTeamErr:", teamErr);
    return NextResponse.json({ ok: false, error: "Team not found" }, { status: 400 });
  }

  if (teamRow.has_voted) {
    return NextResponse.json({ ok: false, error: "Hai già votato" }, { status: 400 });
  }

  // 2) recupera la team_id dell'opzione per bloccare il voto “stessa squadra”
  const { data: optRow, error: optErr } = await supabase
    .from("options")
    .select("id, team_id")
    .eq("id", option_id)
    .single();

  if (optErr || !optRow) {
    console.error("voteOptErr:", optErr);
    return NextResponse.json({ ok: false, error: "Opzione non trovata" }, { status: 404 });
  }

  if (Number(optRow.team_id) === team_id) {
    return NextResponse.json({ ok: false, error: "Non puoi votare un'opzione della tua squadra" }, { status: 400 });
  }

  // 3) salva voto
  const { error: insErr } = await supabase
    .from("votes")
    .insert({ team_id, option_id });

  if (insErr) {
    console.error("voteInsertErr:", insErr);
    return NextResponse.json({ ok: false, error: "DB error (insert vote)" }, { status: 500 });
  }

  // 4) set has_voted=true
  const { error: updErr } = await supabase
    .from("teams")
    .update({ has_voted: true })
    .eq("id", team_id);

  if (updErr) {
    console.error("voteUpdateTeamErr:", updErr);
    return NextResponse.json({ ok: false, error: "DB error (update team)" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}