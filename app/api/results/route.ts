import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { isAdminRequest } from "@/lib/admin-auth";

export async function GET(req: Request) {
  const auth = await isAdminRequest(req);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  // 1) opzioni (la tua tabella si chiama "options")
  const { data: options, error: optErr } = await supabase
    .from("options")
    .select("id, name, team_id, media_url")
    .order("id", { ascending: true });

  if (optErr) {
    console.error("resultsOptionsErr:", optErr);
    return NextResponse.json({ ok: false, error: "DB error (options)" }, { status: 500 });
  }

  // 2) voti (contiamo per option_id)
  const { data: votes, error: voteErr } = await supabase
    .from("votes")
    .select("option_id");

  if (voteErr) {
    console.error("resultsVotesErr:", voteErr);
    return NextResponse.json({ ok: false, error: "DB error (votes)" }, { status: 500 });
  }

  // 3) conteggio
  const counts = new Map<number, number>();
  for (const v of votes ?? []) {
    const id = Number((v as any).option_id);
    if (!id) continue;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }

  const results =
    (options ?? []).map((o: any) => ({
      option_id: o.id,
      option_name: o.name,
      option_team_id: o.team_id,
      media_url: o.media_url ?? null,
      votes: counts.get(o.id) ?? 0,
    })) ?? [];

  const total_votes = results.reduce((sum: number, r: any) => sum + (r.votes ?? 0), 0);

  return NextResponse.json({ ok: true, total_votes, results });
}
