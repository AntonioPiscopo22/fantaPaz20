import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { isAdminRequest } from "@/lib/admin-auth";

export async function GET(req: Request) {
  const auth = await isAdminRequest(req);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("teams")
    .select("id, name, has_voted")
    .order("id", { ascending: true });

  if (error) {
    console.error("teamsErr:", error);
    return NextResponse.json({ ok: false, error: "DB error (teams)" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, teams: data ?? [] });
}
