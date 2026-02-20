import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabase } from "@/lib/supabase";
import { verifySignedSession } from "@/lib/session";

export async function GET() {
  const cookieStore = await cookies();
  const raw = cookieStore.get("session")?.value;

  if (!raw) {
    return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });
  }

  const session = verifySignedSession(raw);
  if (!session?.email || !session?.team_id) {
    return NextResponse.json({ ok: false, error: "Invalid session" }, { status: 401 });
  }

  // Team
  const { data: team, error: teamErr } = await supabase
    .from("teams")
    .select("id, name, has_voted")
    .eq("id", session.team_id)
    .maybeSingle();

  if (teamErr) {
    console.error("teamErr:", teamErr);
    return NextResponse.json({ ok: false, error: "DB error (teams)" }, { status: 500 });
  }

  // Voter (nome/cognome)
  const { data: voter, error: voterErr } = await supabase
    .from("voters")
    .select("first_name, last_name")
    .eq("email", session.email)
    .maybeSingle();

  if (voterErr) {
    console.error("voterErr:", voterErr);
    // non blocchiamo, nome è opzionale
  }

  return NextResponse.json({
    ok: true,
    email: session.email,
    team_id: session.team_id,
    team: team?.name ?? null,
    has_voted: team?.has_voted ?? false,
    first_name: voter?.first_name ?? null,
    last_name: voter?.last_name ?? null,
  });
}
