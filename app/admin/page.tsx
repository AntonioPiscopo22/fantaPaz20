"use client";

import React, { useEffect, useMemo, useState } from "react";

type Team = { id: number; name: string; has_voted: boolean };
type ResultRow = {
  option_id: number;
  option_name: string;
  option_team_id: number;
  media_url: string | null;
  votes: number;
};
type OptionRow = { id: number; name: string; team_id: number; media_url: string | null };

// =====================
// UI helpers (NO LOGIC)
// =====================

function FlexRow({
  left,
  right,
}: {
  left: React.ReactNode;
  right: React.ReactNode;
}) {
  return (
    <div
      style={{
        border: "1px solid rgba(0,0,0,0.08)",
        borderRadius: 14,
        padding: 12,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 12,
        // ✅ mobile-safe
        flexWrap: "nowrap",
      }}
    >
      {/* ✅ LA CHIAVE: il testo può restringersi */}
      <div style={{ minWidth: 0, flex: 1 }}>{left}</div>

      {/* ✅ la colonna destra non deve “spingere fuori” */}
      <div style={{ flexShrink: 0 }}>{right}</div>
    </div>
  );
}

function TitleEllipsis({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontWeight: 950,
        color: "#111",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </div>
  );
}

function Pill({ children, minWidth = 56 }: { children: React.ReactNode; minWidth?: number }) {
  return (
    <div
      style={{
        background: "linear-gradient(90deg, #ffcc00, #ff7a00)",
        padding: "8px 12px",
        borderRadius: 999,
        fontWeight: 950,
        color: "#111",
        minWidth,
        textAlign: "center",
      }}
    >
      {children}
    </div>
  );
}

function Card({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <div
      id={id}
      style={{
        background: "white",
        borderRadius: 18,
        padding: 16,
        border: "1px solid rgba(0,0,0,0.08)",
        boxShadow: "0 2px 14px rgba(0,0,0,0.10)",
      }}
    >
      {children}
    </div>
  );
}

// =====================
// PAGE (LOGIC UNCHANGED)
// =====================

export default function AdminPage() {
  // Auth
  const [adminPassword, setAdminPassword] = useState("");
  const [authed, setAuthed] = useState(false);
  const [authedByTeam, setAuthedByTeam] = useState(false);

  // Data
  const [teams, setTeams] = useState<Team[]>([]);
  const [results, setResults] = useState<ResultRow[]>([]);
  const [options, setOptions] = useState<OptionRow[]>([]);

  // UI state
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Option form state
  const [optName, setOptName] = useState("");
  const [optTeamId, setOptTeamId] = useState<number | null>(null);
  const [teamSearch, setTeamSearch] = useState("");
  const [optMediaUrl, setOptMediaUrl] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);

  const totalVotes = useMemo(
    () => results.reduce((sum, r) => sum + (r.votes ?? 0), 0),
    [results]
  );

  const teamNameById = useMemo(() => {
    const m = new Map<number, string>();
    for (const t of teams) m.set(t.id, t.name);
    return m;
  }, [teams]);

  function resetOptionForm() {
    setEditingId(null);
    setOptName("");
    setOptMediaUrl("");
    setTeamSearch("");
    setOptTeamId(null);
  }

  // ========== LOADERS ==========

  async function loadTeams(pw?: string) {
    const url = pw
      ? `/api/admin/teams?admin_password=${encodeURIComponent(pw)}`
      : `/api/admin/teams`;

    const res = await fetch(url, { cache: "no-store" });
    const json = await res.json();
    if (!res.ok || !json.ok) throw new Error(json?.error ?? "Errore teams");
    setTeams(json.teams ?? []);
  }

  async function loadResults(pw?: string) {
    const url = pw ? `/api/results?admin_password=${encodeURIComponent(pw)}` : `/api/results`;

    const res = await fetch(url, { cache: "no-store" });
    const json = await res.json();
    if (!res.ok || !json.ok) throw new Error(json?.error ?? "Errore results");
    setResults(json.results ?? []);
  }

  async function loadOptions() {
    const res = await fetch(`/api/admin/options`, { cache: "no-store" });
    const json = await res.json();
    if (!res.ok || !json.ok) throw new Error(json?.error ?? "Errore options");
    setOptions(json.options ?? []);
  }

  async function loadAllWithPassword(pw: string) {
    setErr(null);
    setLoading(true);
    try {
      await loadTeams(pw);
      await loadResults(pw);
      await loadOptions();
      setAuthed(true);
      setAuthedByTeam(false);
    } catch (e: any) {
      setAuthed(false);
      setErr(e?.message ?? "Errore");
    } finally {
      setLoading(false);
    }
  }

  async function loadAllWithoutPassword() {
    setErr(null);
    setLoading(true);
    try {
      await loadTeams(undefined);
      await loadResults(undefined);
      await loadOptions();
      setAuthed(true);
      setAuthedByTeam(true);
    } catch (e: any) {
      setAuthed(false);
      setErr(e?.message ?? "Errore");
    } finally {
      setLoading(false);
    }
  }

  // Auto-login se whitelist team
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/is-admin", { cache: "no-store" });
        const json = await res.json();
        if (json?.ok && json?.is_admin) {
          await loadAllWithoutPassword();
        }
      } catch {
        // ignore
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ========== ACTIONS ==========

  async function resetTeam(teamId: number) {
    const ok = window.confirm("Vuoi annullare il voto di questa squadra?");
    if (!ok) return;

    setErr(null);
    setLoading(true);

    try {
      const res = await fetch("/api/admin/reset-team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          authedByTeam ? { team_id: teamId } : { admin_password: adminPassword, team_id: teamId }
        ),
      });

      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json?.error ?? "Errore reset");

      setTeamSearch("");
      if (authedByTeam) await loadAllWithoutPassword();
      else await loadAllWithPassword(adminPassword);
    } catch (e: any) {
      setErr(e?.message ?? "Errore reset");
    } finally {
      setLoading(false);
    }
  }

  async function createOrUpdateOption() {
    setErr(null);

    const name = optName.trim();
    if (!name) {
      setErr("Nome opzione richiesto.");
      return;
    }
    if (!optTeamId || !teamNameById.get(optTeamId)) {
      setErr("Seleziona una squadra valida dal menu.");
      return;
    }

    setLoading(true);

    try {
      const payload = {
        name,
        team_id: optTeamId,
        media_url: optMediaUrl.trim() ? optMediaUrl.trim() : null,
      };

      const url = editingId ? `/api/admin/options/${editingId}` : "/api/admin/options";
      const method = editingId ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json?.error ?? "Errore salvataggio opzione");

      resetOptionForm();

      await loadOptions();
      await loadResults(authedByTeam ? undefined : adminPassword);
    } catch (e: any) {
      setErr(e?.message ?? "Errore");
    } finally {
      setLoading(false);
    }
  }

  function startEdit(o: OptionRow) {
    setEditingId(o.id);
    setOptName(o.name ?? "");
    setOptTeamId(Number(o.team_id ?? 0) || null);
    setOptMediaUrl(o.media_url ?? "");
    setTeamSearch(teamNameById.get(Number(o.team_id)) ?? "");

    document.getElementById("options-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function deleteOption(id: number) {
    const ok = window.confirm("Vuoi cancellare questa opzione? (Cancella anche eventuali voti collegati)");
    if (!ok) return;

    setErr(null);
    setLoading(true);

    try {
      const res = await fetch(`/api/admin/options/${id}`, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));

      if (!res.ok || !json.ok) throw new Error(json?.error ?? "Errore cancellazione opzione");

      await loadOptions();
      await loadResults(authedByTeam ? undefined : adminPassword);
    } catch (e: any) {
      setErr(e?.message ?? "Errore");
    } finally {
      setLoading(false);
    }
  }

  async function deleteAllOptions() {
    const ok = window.confirm(
      "ATTENZIONE: cancello TUTTE le opzioni, TUTTI i voti e resetto tutte le squadre (has_voted=false). Continuare?"
    );
    if (!ok) return;

    setErr(null);
    setLoading(true);

    try {
      const res = await fetch("/api/admin/options/delete-all", { method: "POST" });
      const json = await res.json();

      if (!res.ok || !json.ok) throw new Error(json?.error ?? "Errore cancellazione totale");

      resetOptionForm();
      setOptions([]);
      setResults([]);

      if (authedByTeam) await loadAllWithoutPassword();
      else await loadAllWithPassword(adminPassword);
    } catch (e: any) {
      setErr(e?.message ?? "Errore");
    } finally {
      setLoading(false);
    }
  }

  // ========== UI ==========

  return (
    <main style={pageBg()}>
      {/* Top bar */}
      <div style={topBar()}>
        <span>Admin</span>
        <img
          src="/logo.png"
          alt="Logo"
          style={{
            width: 50,
            height: 50,
            borderRadius: 10,
            objectFit: "cover",
            boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
            border: "1px solid rgba(255,255,255,0.25)",
          }}
        />
      </div>

      <div style={{ maxWidth: 980, margin: "0 auto", padding: 16, overflowX: "hidden" }}>
        {!authed ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              loadAllWithPassword(adminPassword);
            }}
            style={{
              background: "white",
              borderRadius: 18,
              padding: 16,
              border: "1px solid rgba(0,0,0,0.08)",
              boxShadow: "0 2px 14px rgba(0,0,0,0.10)",
              maxWidth: 520,
              margin: "0 auto",
            }}
          >
            <div style={{ fontWeight: 950, fontSize: 18, color: "#111" }}>Accesso Admin</div>
            <input
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              placeholder="password"
              type="password"
              style={{
                marginTop: 12,
                width: "100%",
                padding: 12,
                borderRadius: 12,
                border: "1px solid rgba(0,0,0,0.18)",
                fontSize: 16,
                color: "#111",
              }}
            />

            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: 12,
                width: "100%",
                padding: 12,
                borderRadius: 14,
                border: "none",
                background: "linear-gradient(90deg, #ffcc00, #ff7a00)",
                color: "#111",
                fontWeight: 950,
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? "Verifico..." : "Entra"}
            </button>

            {err && (
              <div
                style={{
                  marginTop: 12,
                  padding: 12,
                  borderRadius: 14,
                  background: "#fff0f0",
                  border: "1px solid rgba(200,0,0,0.2)",
                  color: "#7a1010",
                  fontWeight: 900,
                }}
              >
                {err}
              </div>
            )}
          </form>
        ) : (
          <div style={{ display: "grid", gap: 14 }}>
            {err && (
              <div
                style={{
                  padding: 12,
                  borderRadius: 14,
                  background: "#fff0f0",
                  border: "1px solid rgba(200,0,0,0.2)",
                  color: "#7a1010",
                  fontWeight: 900,
                }}
              >
                {err}
              </div>
            )}

            {/* Risultati */}
            <Card>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 950, fontSize: 18, color: "#111" }}>Risultati</div>
                  <div style={{ color: "#333", marginTop: 4, fontSize: 13 }}>
                    Totale voti: <b>{totalVotes}</b>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => (authedByTeam ? loadAllWithoutPassword() : loadAllWithPassword(adminPassword))}
                  disabled={loading}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 12,
                    border: "1px solid rgba(0,0,0,0.12)",
                    background: "linear-gradient(90deg, #ffcc00, #ff7a00)",
                    fontWeight: 950,
                    cursor: loading ? "not-allowed" : "pointer",
                    color: "#111",
                    opacity: loading ? 0.7 : 1,
                    flexShrink: 0,
                  }}
                >
                  {loading ? "..." : "Refresh"}
                </button>
              </div>

              <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                {results.map((r) => (
                  <FlexRow
                    key={r.option_id}
                    left={
                      <>
                        <TitleEllipsis>{r.option_name}</TitleEllipsis>
                        <div style={{ fontSize: 13, color: "#333" }}>ID: {r.option_id}</div>
                      </>
                    }
                    right={<Pill>{r.votes}</Pill>}
                  />
                ))}
              </div>
            </Card>

            {/* Squadre */}
            <Card>
              <div style={{ fontWeight: 950, fontSize: 18, color: "#111" }}>Squadre</div>

              <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                {teams.map((t) => (
                  <FlexRow
                    key={t.id}
                    left={
                      <>
                        <TitleEllipsis>
                          #{t.id} — {t.name}
                        </TitleEllipsis>
                        <div style={{ fontSize: 13, color: "#333" }}>
                          Stato:{" "}
                          <b style={{ color: t.has_voted ? "#0b5" : "#d97b00" }}>
                            {t.has_voted ? "ha votato" : "può votare"}
                          </b>
                        </div>
                      </>
                    }
                    right={
                      <button
                        type="button"
                        onClick={() => resetTeam(t.id)}
                        disabled={!t.has_voted || loading}
                        style={{
                          padding: "10px 12px",
                          borderRadius: 12,
                          border: "none",
                          background: t.has_voted
                            ? "linear-gradient(90deg, #ffcc00, #ff7a00)"
                            : "#eaeaea",
                          color: "#111",
                          fontWeight: 950,
                          cursor: t.has_voted ? "pointer" : "not-allowed",
                          opacity: t.has_voted ? 1 : 0.65,
                        }}
                      >
                        Reset
                      </button>
                    }
                  />
                ))}
              </div>
            </Card>

            {/* Opzioni (CRUD) */}
            <Card id="options-panel">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <div style={{ fontWeight: 950, fontSize: 18, color: "#111" }}>Opzioni</div>

                <button
                  type="button"
                  onClick={deleteAllOptions}
                  disabled={loading}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 12,
                    border: "none",
                    background: "linear-gradient(90deg, #ff7a00, #ffcc00)",
                    color: "#111",
                    fontWeight: 950,
                    cursor: loading ? "not-allowed" : "pointer",
                    opacity: loading ? 0.7 : 1,
                    flexShrink: 0,
                  }}
                  title="Cancella tutte le opzioni, tutti i voti, e resetta tutte le squadre"
                >
                  Cancella tutto
                </button>
              </div>

              {/* Form add/edit */}
              <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                <input
                  value={optName}
                  onChange={(e) => setOptName(e.target.value)}
                  placeholder="Nome opzione"
                  style={{
                    padding: 12,
                    borderRadius: 12,
                    border: "1px solid rgba(0,0,0,0.18)",
                    fontSize: 16,
                    color: "#111",
                  }}
                />

                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ fontSize: 13, fontWeight: 900, color: "#333" }}>Squadra</div>

                  <input
                    list="teams-datalist"
                    value={teamSearch}
                    onChange={(e) => {
                      const v = e.target.value;
                      setTeamSearch(v);

                      const found = teams.find((t) => t.name.toLowerCase() === v.trim().toLowerCase());
                      if (found) setOptTeamId(found.id);
                    }}
                    placeholder="Scrivi per cercare…"
                    style={{
                      padding: 12,
                      borderRadius: 12,
                      border: "1px solid rgba(0,0,0,0.18)",
                      fontSize: 16,
                      color: "#111",
                    }}
                  />

                  <datalist id="teams-datalist">
                    {teams.map((t) => (
                      <option key={t.id} value={t.name} />
                    ))}
                  </datalist>

                  <div style={{ fontSize: 12, color: "#555" }}>
                    Selezionata: <b>{optTeamId ? teamNameById.get(optTeamId) ?? "—" : "—"}</b>{" "}
                    <span style={{ opacity: 0.7 }}>(id: {optTeamId ?? "—"})</span>
                  </div>
                </div>

                <input
                  value={optMediaUrl}
                  onChange={(e) => setOptMediaUrl(e.target.value)}
                  placeholder="Media URL (YouTube o mp4) — opzionale"
                  style={{
                    padding: 12,
                    borderRadius: 12,
                    border: "1px solid rgba(0,0,0,0.18)",
                    fontSize: 16,
                    color: "#111",
                  }}
                />

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={createOrUpdateOption}
                    disabled={loading}
                    style={{
                      flex: "1 1 220px",
                      padding: 12,
                      borderRadius: 14,
                      border: "none",
                      background: "linear-gradient(90deg, #ffcc00, #ff7a00)",
                      color: "#111",
                      fontWeight: 950,
                      cursor: loading ? "not-allowed" : "pointer",
                      opacity: loading ? 0.7 : 1,
                    }}
                  >
                    {editingId ? "Salva modifiche" : "Aggiungi opzione"}
                  </button>

                  {editingId && (
                    <button
                      type="button"
                      onClick={() => resetOptionForm()}
                      disabled={loading}
                      style={{
                        padding: 12,
                        borderRadius: 14,
                        border: "1px solid rgba(0,0,0,0.15)",
                        background: "white",
                        color: "#111",
                        fontWeight: 950,
                        cursor: loading ? "not-allowed" : "pointer",
                        opacity: loading ? 0.7 : 1,
                      }}
                    >
                      Annulla
                    </button>
                  )}
                </div>
              </div>

              {/* Lista opzioni */}
              <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
                {options.map((o) => (
                  <FlexRow
                    key={o.id}
                    left={
                      <>
                        <TitleEllipsis>
                          #{o.id} — {o.name}
                        </TitleEllipsis>

                        <div style={{ fontSize: 13, color: "#333", minWidth: 0 }}>
                          Squadra: <b>{teamNameById.get(Number(o.team_id)) ?? `ID ${o.team_id}`}</b>
                          <span style={{ fontSize: 12, opacity: 0.7 }}> (id: {o.team_id})</span> — media:{" "}
                          {o.media_url ? (
                            <>
                              <b
                                style={{
                                  display: "inline-block",
                                  maxWidth: "100%",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                  verticalAlign: "bottom",
                                }}
                                title={o.media_url}
                              >
                                {o.media_url}
                              </b>
                              <a
                                href={o.media_url}
                                target="_blank"
                                rel="noreferrer"
                                style={{
                                  marginLeft: 10,
                                  display: "inline-block",
                                  padding: "6px 10px",
                                  borderRadius: 999,
                                  background: "rgba(255, 204, 0, 0.22)",
                                  border: "1px solid rgba(0,0,0,0.12)",
                                  color: "#111",
                                  fontWeight: 900,
                                  textDecoration: "none",
                                }}
                              >
                                Apri
                              </a>
                            </>
                          ) : (
                            <b>—</b>
                          )}
                        </div>
                      </>
                    }
                    right={
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            startEdit(o);
                          }}
                          disabled={loading}
                          style={{
                            padding: "10px 12px",
                            borderRadius: 12,
                            border: "none",
                            background:
                              "linear-gradient(90deg, rgba(233, 204, 192, 0.9), rgba(238, 186, 136, 0.9))",
                            color: "#111",
                            fontWeight: 950,
                            cursor: loading ? "not-allowed" : "pointer",
                            opacity: loading ? 0.6 : 1,
                          }}
                        >
                          Modifica
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            deleteOption(o.id);
                          }}
                          disabled={loading}
                          style={{
                            padding: "10px 12px",
                            borderRadius: 12,
                            border: "none",
                            background: "#ffefef",
                            color: "#7a1010",
                            fontWeight: 950,
                            cursor: loading ? "not-allowed" : "pointer",
                            opacity: loading ? 0.7 : 1,
                          }}
                        >
                          Cancella
                        </button>
                      </div>
                    }
                  />
                ))}
              </div>
            </Card>
          </div>
        )}
      </div>
    </main>
  );
}

// ======== styles creators (tiny) ========
function pageBg(): React.CSSProperties {
  return {
    minHeight: "100dvh",
    background:
      "radial-gradient(circle at 12% 0%, rgba(255, 204, 0, 0.14), transparent 36%), radial-gradient(circle at 88% 10%, rgba(255, 122, 0, 0.12), transparent 40%), #f2efe9",
  };
}

function topBar(): React.CSSProperties {
  return {
    background: "#075e54",
    color: "white",
    padding: "14px 16px",
    fontWeight: 950,
    fontSize: 18,
    position: "sticky",
    top: 0,
    zIndex: 10,
    boxShadow: "0 2px 10px rgba(0,0,0,0.12)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  };
}