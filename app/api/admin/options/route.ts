import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { isAdminRequest } from "@/lib/admin-auth";

function toIntOrNull(v: any): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.floor(n);
}

export async function GET(req: Request) {
  const auth = await isAdminRequest(req);
  if (!auth.ok) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("options")
    .select("id, name, team_id, media_url, start_sec, end_sec")
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

  const start_sec = toIntOrNull(body.start_sec);
  const end_sec = toIntOrNull(body.end_sec);

  if (!name) return NextResponse.json({ ok: false, error: "name required" }, { status: 400 });
  if (!team_id) return NextResponse.json({ ok: false, error: "team_id required" }, { status: 400 });

  // Se uno dei due è presente, devono esserlo entrambi
  const hasStart = start_sec !== null;
  const hasEnd = end_sec !== null;

  if (hasStart !== hasEnd) {
    return NextResponse.json(
      { ok: false, error: "start_sec and end_sec must be both provided (or both null)" },
      { status: 400 }
    );
  }

  // Se entrambi presenti: end > start e start >= 0
  if (hasStart && hasEnd) {
    if (start_sec! < 0 || end_sec! < 0) {
      return NextResponse.json({ ok: false, error: "start_sec/end_sec must be >= 0" }, { status: 400 });
    }
    if (end_sec! <= start_sec!) {
      return NextResponse.json({ ok: false, error: "end_sec must be > start_sec" }, { status: 400 });
    }
  }

  const insertPayload = {
    name,
    team_id,
    media_url,
    start_sec,
    end_sec,
  };

  const { data, error } = await supabase
    .from("options")
    .insert(insertPayload)
    .select("id, name, team_id, media_url, start_sec, end_sec")
    .single();

  if (error) {
    console.error("optionsPostErr:", error);
    return NextResponse.json({ ok: false, error: "DB error (insert option)" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, option: data });
}