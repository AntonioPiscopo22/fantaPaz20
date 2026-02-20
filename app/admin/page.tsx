"use client";

import React, { useEffect, useMemo, useState } from "react";

type Team = { id: number; name: string; has_voted: boolean };
type ResultRow = {
  option_id: number;
  option_name: string;
  option_team_id: number;
  media_url: string | null;
  start_sec: number | null;
  end_sec: number | null;
  votes: number;
};
type OptionRow = {
  id: number;
  name: string;
  team_id: number;
  media_url: string | null;
  start_sec: number | null;
  end_sec: number | null;
};

// =====================
// UI helpers (NO LOGIC)
// =====================

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
  // ✅ centrato e mobile-friendly come VotePage
  return (
    <div style={{ padding: 12, display: "grid", placeItems: "center" }}>
      <div
        id={id}
        style={{
          width: "100%",
          maxWidth: 620,
          background: "white",
          borderRadius: 18,
          padding: 16,
          border: "1px solid rgba(0,0,0,0.08)",
          boxShadow: "0 2px 14px rgba(0,0,0,0.10)",
          overflow: "hidden", // ✅ evita “allargamenti” su iOS
        }}
      >
        {children}
      </div>
    </div>
  );
}

function AccordionCard({
  title,
  subtitle,
  children,
  defaultOpen = true,
  right,
  id,
}: {
  title: string;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  right?: React.ReactNode;
  id?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Card id={id}>
      <div
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          cursor: "pointer",
          userSelect: "none",
          flexWrap: "wrap", // ✅ header wrap-friendly
          minWidth: 0,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 950, fontSize: 18, color: "#111" }}>{title}</div>
          {subtitle && <div style={{ color: "#333", marginTop: 4, fontSize: 13 }}>{subtitle}</div>}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            flex: "0 0 auto",
            marginLeft: "auto",
            maxWidth: "100%",
            flexWrap: "wrap",
            justifyContent: "flex-end",
          }}
        >
          {right}

          {/* freccia (stile richiesto) */}
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 14,
              display: "grid",
              placeItems: "center",
              border: "none",
              background: "rgba(0,0,0,0.08)",
              color: "#111",
              flexShrink: 0,
            }}
            aria-label={open ? "Chiudi" : "Apri"}
            title={open ? "Chiudi" : "Apri"}
          >
            {open ? "▾" : "▸"}
          </div>
        </div>
      </div>

      {open && <div style={{ marginTop: 12, minWidth: 0, maxWidth: "100%" }}>{children}</div>}
    </Card>
  );
}

function ConfirmModal({
  open,
  title,
  description,
  confirmText = "Conferma",
  cancelText = "Annulla",
  loading,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.45)",
        display: "grid",
        placeItems: "center",
        zIndex: 100000,
        padding: 16,
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 520,
          borderRadius: 18,
          background: "#ffffff",
          color: "#111",
          border: "1px solid rgba(0,0,0,0.10)",
          padding: 16,
          boxShadow: "0 14px 50px rgba(0,0,0,0.25)",
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div style={{ fontSize: 18, fontWeight: 950 }}>{title}</div>

        {description && (
          <div style={{ marginTop: 8, color: "#333", lineHeight: 1.35 }}>{description}</div>
        )}

        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <button
            onClick={onCancel}
            disabled={!!loading}
            style={{
              flex: 1,
              padding: 12,
              borderRadius: 12,
              border: "1px solid rgba(0,0,0,0.15)",
              background: "#fff",
              color: "#111",
              fontWeight: 900,
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {cancelText}
          </button>

          <button
            onClick={onConfirm}
            disabled={!!loading}
            style={{
              flex: 1,
              padding: 12,
              borderRadius: 12,
              border: "none",
              background: "linear-gradient(90deg, #ffcc00, #ff7a00)",
              color: "#111",
              fontWeight: 950,
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "..." : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

function IconBtn({
  title,
  onClick,
  disabled,
  children,
  danger,
}: {
  title: string;
  onClick?: (e: React.MouseEvent) => void;
  disabled?: boolean;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={title}
      title={title}
      style={{
        height: 40,
        width: 44,
        display: "grid",
        placeItems: "center",
        borderRadius: 12,
        border: danger ? "1px solid rgba(200,0,0,0.25)" : "1px solid rgba(0,0,0,0.12)",
        background: danger ? "#ffefef" : "rgba(255, 204, 0, 0.22)",
        color: danger ? "#7a1010" : "#111",
        fontWeight: 950,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
        flexShrink: 0,
      }}
    >
      {children}
    </button>
  );
}

function IconPencil({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 20h9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path
        d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconTrash({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3 6h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M8 6V4h8v2" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M6 6l1 16h10l1-16" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function IconRefresh({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M21 12a9 9 0 0 1-15.3 6.4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M3 12a9 9 0 0 1 15.3-6.4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M7 17H5v-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M17 7h2v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function FlexRow({ left, right }: { left: React.ReactNode; right: React.ReactNode }) {
  return (
    <div
      style={{
        border: "1px solid rgba(0,0,0,0.08)",
        borderRadius: 14,
        padding: 12,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: 10,
        flexWrap: "wrap",
      }}
    >
      <div style={{ minWidth: 0, flex: "1 1 260px" }}>{left}</div>

      <div
        style={{
          flex: "0 0 auto",
          marginLeft: "auto",
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          justifyContent: "flex-end",
          maxWidth: "100%",
        }}
      >
        {right}
      </div>
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
  const [optStartSec, setOptStartSec] = useState<string>("");
  const [optEndSec, setOptEndSec] = useState<string>("");
  const [editingId, setEditingId] = useState<number | null>(null);

  // Confirm modal state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState("");
  const [confirmDesc, setConfirmDesc] = useState<string | undefined>(undefined);
  const [confirmCta, setConfirmCta] = useState("Conferma");
  const [confirmAction, setConfirmAction] = useState<null | (() => Promise<void> | void)>(null);

  const totalVotes = useMemo(() => results.reduce((sum, r) => sum + (r.votes ?? 0), 0), [results]);

  const teamNameById = useMemo(() => {
    const m = new Map<number, string>();
    for (const t of teams) m.set(t.id, t.name);
    return m;
  }, [teams]);

  function askConfirm(opts: { title: string; desc?: string; cta?: string; action: () => Promise<void> | void }) {
    setConfirmTitle(opts.title);
    setConfirmDesc(opts.desc);
    setConfirmCta(opts.cta ?? "Conferma");
    setConfirmAction(() => opts.action);
    setConfirmOpen(true);
  }

  function resetOptionForm() {
    setEditingId(null);
    setOptName("");
    setOptMediaUrl("");
    setTeamSearch("");
    setOptTeamId(null);
    setOptStartSec("");
    setOptEndSec("");
  }

  const isDirtyForm =
    !!editingId ||
    optName.trim() !== "" ||
    teamSearch.trim() !== "" ||
    optMediaUrl.trim() !== "" ||
    optStartSec.trim() !== "" ||
    optEndSec.trim() !== "";

  // ========== LOADERS ==========

  async function loadTeams(pw?: string) {
    const url = pw ? `/api/admin/teams?admin_password=${encodeURIComponent(pw)}` : `/api/admin/teams`;

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
    askConfirm({
      title: "Confermi reset voto?",
      desc: "Vuoi annullare il voto di questa squadra?",
      cta: "Reset",
      action: async () => {
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
          setConfirmOpen(false);
          setConfirmAction(null);
        }
      },
    });
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
      const start_sec = optStartSec.trim() === "" ? null : Number(optStartSec);
      const end_sec = optEndSec.trim() === "" ? null : Number(optEndSec);

      const payload = {
        name,
        team_id: optTeamId,
        media_url: optMediaUrl.trim() ? optMediaUrl.trim() : null,
        start_sec,
        end_sec,
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

    setOptStartSec(o.start_sec === null || o.start_sec === undefined ? "" : String(o.start_sec));
    setOptEndSec(o.end_sec === null || o.end_sec === undefined ? "" : String(o.end_sec));

    document.getElementById("options-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function deleteOption(id: number) {
    askConfirm({
      title: "Confermi cancellazione?",
      desc: "Vuoi cancellare questa opzione? (Cancella anche eventuali voti collegati)",
      cta: "Cancella",
      action: async () => {
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
          setConfirmOpen(false);
          setConfirmAction(null);
        }
      },
    });
  }

  async function deleteAllOptions() {
    askConfirm({
      title: "Confermi cancellazione totale?",
      desc: "Cancello TUTTE le opzioni (e i voti collegati). Continuare?",
      cta: "Cancella tutto",
      action: async () => {
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
          setConfirmOpen(false);
          setConfirmAction(null);
        }
      },
    });
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

      <div style={{ maxWidth: 820, margin: "0 auto", padding: 16, overflowX: "hidden" }}>
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
            <AccordionCard
              title="Risultati"
              subtitle={
                <>
                  Totale voti: <b>{totalVotes}</b>
                </>
              }
              right={
                <IconBtn
                  title="Refresh"
                  disabled={loading}
                  onClick={(e) => {
                    e.stopPropagation();
                    authedByTeam ? loadAllWithoutPassword() : loadAllWithPassword(adminPassword);
                  }}
                >
                  <IconRefresh />
                </IconBtn>
              }
              defaultOpen={true}
            >
              <div style={{ display: "grid", gap: 10 }}>
                {results.map((r) => (
                  <FlexRow
                    key={r.option_id}
                    left={
                      <>
                        <TitleEllipsis>{r.option_name}</TitleEllipsis>
                        <div style={{ fontSize: 13, color: "#333" }}>
                          ID: {r.option_id}
                          {r.start_sec != null && r.end_sec != null && (
                            <>
                              {" "}
                              — clip: <b>{r.start_sec}</b>–<b>{r.end_sec}</b>s
                            </>
                          )}
                        </div>
                      </>
                    }
                    right={<Pill>{r.votes}</Pill>}
                  />
                ))}
              </div>
            </AccordionCard>

            {/* Squadre */}
            <AccordionCard title="Squadre" defaultOpen={false}>
              <div style={{ display: "grid", gap: 10 }}>
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
                          background: t.has_voted ? "linear-gradient(90deg, #ffcc00, #ff7a00)" : "#eaeaea",
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
            </AccordionCard>

            {/* Opzioni (CRUD) */}
            <AccordionCard
              title="Opzioni"
              id="options-panel"
              defaultOpen={true}
              right={
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteAllOptions();
                  }}
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
                  title="Cancella tutte le opzioni (e i voti collegati)"
                >
                  Cancella tutto
                </button>
              }
            >
              {/* Form add/edit */}
              <div style={{ display: "grid", gap: 10 }}>
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

                {/* Clip seconds */}
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ fontSize: 13, fontWeight: 900, color: "#333" }}>Clip (secondi) — opzionale</div>

                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <input
                      value={optStartSec}
                      onChange={(e) => setOptStartSec(e.target.value)}
                      placeholder="start_sec (es: 42)"
                      inputMode="numeric"
                      style={{
                        flex: "1 1 160px",
                        padding: 12,
                        borderRadius: 12,
                        border: "1px solid rgba(0,0,0,0.18)",
                        fontSize: 16,
                        color: "#111",
                      }}
                    />

                    <input
                      value={optEndSec}
                      onChange={(e) => setOptEndSec(e.target.value)}
                      placeholder="end_sec (es: 57)"
                      inputMode="numeric"
                      style={{
                        flex: "1 1 160px",
                        padding: 12,
                        borderRadius: 12,
                        border: "1px solid rgba(0,0,0,0.18)",
                        fontSize: 16,
                        color: "#111",
                      }}
                    />
                  </div>

                  <div style={{ fontSize: 12, color: "#555" }}>
                    Se li imposti entrambi: il video parte a <b>start_sec</b> e si ferma a <b>end_sec</b>.
                  </div>
                </div>

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

                  {isDirtyForm && (
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
                      Reset
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
                          <span style={{ fontSize: 12, opacity: 0.7 }}> (id: {o.team_id})</span>
                          {o.start_sec != null && o.end_sec != null && (
                            <span style={{ marginLeft: 8, fontWeight: 900, color: "#333" }}>
                              — clip: <b>{o.start_sec}</b>–<b>{o.end_sec}</b>s
                            </span>
                          )}{" "}
                          — media:{" "}
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
                      <>
                        <IconBtn
                          title="Modifica"
                          disabled={loading}
                          onClick={(e) => {
                            e.preventDefault();
                            startEdit(o);
                          }}
                        >
                          <IconPencil />
                        </IconBtn>

                        <IconBtn
                          title="Cancella"
                          danger
                          disabled={loading}
                          onClick={(e) => {
                            e.preventDefault();
                            deleteOption(o.id);
                          }}
                        >
                          <IconTrash />
                        </IconBtn>
                      </>
                    }
                  />
                ))}
              </div>
            </AccordionCard>
          </div>
        )}
      </div>

      {/* ✅ Confirm modal (fix iOS: no window.confirm) */}
      <ConfirmModal
        open={confirmOpen}
        title={confirmTitle}
        description={confirmDesc}
        confirmText={confirmCta}
        cancelText="Annulla"
        loading={loading}
        onCancel={() => {
          if (loading) return;
          setConfirmOpen(false);
          setConfirmAction(null);
        }}
        onConfirm={() => {
          if (!confirmAction) return;
          confirmAction();
        }}
      />
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