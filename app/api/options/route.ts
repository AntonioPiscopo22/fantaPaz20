import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabase } from "@/lib/supabase";
import { verifySignedSession } from "@/lib/session";

export const dynamic = "force-dynamic";

type OptionDbRow = {
  id: number;
  name: string;
  team_id: number;
  media_url: string | null;
  team: { name: string } | null;
};

export async function GET() {
  const cookieStore = await cookies();
  const raw = cookieStore.get("session")?.value;

  if (!raw) {
    return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });
  }

  const session = verifySignedSession(raw);
  if (!session?.team_id) {
    return NextResponse.json({ ok: false, error: "Invalid session" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("options")
    .select("id, name, team_id, media_url, team:teams!options_team_id_fkey(name)")
    .order("id", { ascending: false });

  if (error) {
    console.error("optionsErr:", error);
    return NextResponse.json({ ok: false, error: "DB error (options)" }, { status: 500 });
  }

  const options = (data ?? []).map((o) => {
    const row = o as unknown as OptionDbRow;
    console.log("options sample:", (data ?? [])[0]);
    return {
      id: row.id,
      name: row.name,
      team_id: row.team_id,
      media_url: row.media_url,
      team_name: row.team?.name ?? null
    };
  });

  return NextResponse.json({ ok: true, options });
}