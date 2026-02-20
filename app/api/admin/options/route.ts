import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { isAdminRequest } from "@/lib/admin-auth";

export async function GET(req: Request) {
  const auth = await isAdminRequest(req);
  if (!auth.ok) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("options")
    .select("id, name, team_id, media_url")
    .order("id", { ascending: false }); // ✅ ultimi inseriti in cima

  if (error) {
    console.error("optionsGetErr:", error);
    return NextResponse.json({ ok: false, error: "DB error (options)" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, options: data ?? [] });
}


export async function POST(req: Request) {
  const auth = await isAdminRequest(req);
  if (!auth.ok) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const name = String(body.name ?? "").trim();
  const team_id = Number(body.team_id);
  const media_url = body.media_url ? String(body.media_url).trim() : null;

  if (!name) return NextResponse.json({ ok: false, error: "name required" }, { status: 400 });
  if (!team_id) return NextResponse.json({ ok: false, error: "team_id required" }, { status: 400 });

  const { data, error } = await supabase
    .from("options")
    .insert({ name, team_id, media_url })
    .select("id, name, team_id, media_url")
    .single();

  if (error) {
    console.error("optionsPostErr:", error);
    return NextResponse.json({ ok: false, error: "DB error (insert option)" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, option: data });
}
