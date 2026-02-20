import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { isAdminRequest } from "@/lib/admin-auth";

export async function POST(req: Request) {
  const auth = await isAdminRequest(req);
  if (!auth.ok) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  // 1) elimina tutti i voti
  const { error: e1 } = await supabase.from("votes").delete().gt("id", 0);
  if (e1) {
    console.error("deleteAllVotesErr:", e1);
    return NextResponse.json({ ok: false, error: "DB error (delete votes)" }, { status: 500 });
  }

  // 2) elimina tutte le opzioni
  const { error: e2 } = await supabase.from("options").delete().gt("id", 0);
  if (e2) {
    console.error("deleteAllOptionsErr:", e2);
    return NextResponse.json({ ok: false, error: "DB error (delete options)" }, { status: 500 });
  }

  // 3) reset stato voto squadre
  const { error: e3 } = await supabase.from("teams").update({ has_voted: false }).gt("id", 0);
  if (e3) {
    console.error("resetAllTeamsErr:", e3);
    return NextResponse.json({ ok: false, error: "DB error (reset teams)" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
