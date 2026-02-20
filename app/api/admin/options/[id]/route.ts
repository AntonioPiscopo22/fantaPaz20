import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { isAdminRequest } from "@/lib/admin-auth";

function toIntOrNull(v: any): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.floor(n);
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await isAdminRequest(req);
  if (!auth.ok) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const optionId = Number(id);
  if (!optionId) return NextResponse.json({ ok: false, error: "invalid id" }, { status: 400 });

  const body = await req.json().catch(() => ({}));

  const patch: any = {};
  if (typeof body.name === "string") patch.name = body.name.trim();
  if (body.team_id !== undefined) patch.team_id = Number(body.team_id);
  if (body.media_url !== undefined) patch.media_url = body.media_url ? String(body.media_url).trim() : null;

  // --- nuovi campi ---
  const startProvided = body.start_sec !== undefined;
  const endProvided = body.end_sec !== undefined;

  if (startProvided || endProvided) {
    const start_sec = toIntOrNull(body.start_sec);
    const end_sec = toIntOrNull(body.end_sec);

    // Se l'admin sta toccando i tempi, li deve mandare entrambi
    if (!startProvided || !endProvided) {
      return NextResponse.json(
        { ok: false, error: "start_sec and end_sec must be both provided when updating times" },
        { status: 400 }
      );
    }

    // Se uno è null, devono essere entrambi null (reset)
    const hasStart = start_sec !== null;
    const hasEnd = end_sec !== null;

    if (hasStart !== hasEnd) {
      return NextResponse.json(
        { ok: false, error: "start_sec and end_sec must be both null (reset) or both numbers" },
        { status: 400 }
      );
    }

    // Se entrambi numeri: validazione
    if (hasStart && hasEnd) {
      if (start_sec! < 0 || end_sec! < 0) {
        return NextResponse.json({ ok: false, error: "start_sec/end_sec must be >= 0" }, { status: 400 });
      }
      if (end_sec! <= start_sec!) {
        return NextResponse.json({ ok: false, error: "end_sec must be > start_sec" }, { status: 400 });
      }
    }

    patch.start_sec = start_sec;
    patch.end_sec = end_sec;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ ok: false, error: "no fields to update" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("options")
    .update(patch)
    .eq("id", optionId)
    .select("id, name, team_id, media_url, start_sec, end_sec")
    .single();

  if (error) {
    console.error("optionsPatchErr:", error);
    return NextResponse.json({ ok: false, error: "DB error (update option)" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, option: data });
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await isAdminRequest(req);
  if (!auth.ok) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const optionId = Number(id);
  if (!optionId) return NextResponse.json({ ok: false, error: "invalid id" }, { status: 400 });

  // prima cancella eventuali voti collegati (evita errori FK)
  const { error: e1 } = await supabase.from("votes").delete().eq("option_id", optionId);
  if (e1) {
    console.error("deleteVotesForOptionErr:", e1);
    return NextResponse.json({ ok: false, error: "DB error (delete votes)" }, { status: 500 });
  }

  const { error: e2 } = await supabase.from("options").delete().eq("id", optionId);
  if (e2) {
    console.error("optionsDeleteErr:", e2);
    return NextResponse.json({ ok: false, error: "DB error (delete option)" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}