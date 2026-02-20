import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabase } from "@/lib/supabase";
import { createSignedSession } from "@/lib/session";

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = normalizeEmail(String(body?.email ?? ""));

    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { ok: false, error: "Email non valida" },
        { status: 400 }
      );
    }

    // 1) Whitelist lookup
    const { data: voter, error: voterErr } = await supabase
      .from("voters")
      .select("email, team_id")
      .eq("email", email)
      .maybeSingle();

    if (voterErr) {
      console.error("voterErr:", voterErr);
      return NextResponse.json(
        { ok: false, error: "Errore database (voters)." },
        { status: 500 }
      );
    }

    if (!voter) {
      return NextResponse.json(
        { ok: false, error: "Email non presente in lista." },
        { status: 401 }
      );
    }

    // 2) Team lookup
    const { data: team, error: teamErr } = await supabase
      .from("teams")
      .select("name, has_voted")
      .eq("id", voter.team_id)
      .maybeSingle();

    if (teamErr) {
      console.error("teamErr:", teamErr);
      return NextResponse.json(
        { ok: false, error: "Errore database (teams)." },
        { status: 500 }
      );
    }

    // 3) Cookie firmato (sessione fino a chiusura browser)
    const signed = createSignedSession({
      email: voter.email,
      team_id: voter.team_id,
    });

    const cookieStore = await cookies(); // ✅ Next 15
    cookieStore.set("session", signed, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });

    return NextResponse.json({
      ok: true,
      team: team?.name ?? null,
      has_voted: team?.has_voted ?? false,
    });
  } catch (e: any) {
    console.error("LOGIN ERROR:", e);
    return NextResponse.json(
      { ok: false, error: String(e?.message ?? e) },
      { status: 500 }
    );
  }
}
