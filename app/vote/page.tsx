"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Me = {
  ok: boolean;
  email: string;
  team: string | null;
  team_id: number;
  has_voted: boolean;
  first_name: string | null;
  last_name: string | null;
};

type Option = {
  id: number;
  name: string;
  media_url: string | null;      // URL del video originale (watch?v=... o youtu.be/...)
  start_sec: number | null;      // inizio in secondi (es: 42)
  end_sec: number | null;        // fine in secondi (es: 57)
  team_id: number;
  team_name: string | null;
};

function extractYouTubeVideoId(url: string): string | null {
  try {
    const u = new URL(url);

    // youtu.be/VIDEO_ID
    if (u.hostname.includes("youtu.be")) {
      const id = u.pathname.split("/").filter(Boolean)[0];
      return id || null;
    }

    if (u.hostname.includes("youtube.com")) {
      // watch?v=VIDEO_ID
      const v = u.searchParams.get("v");
      if (v) return v;

      // /embed/VIDEO_ID
      const embedMatch = u.pathname.match(/\/embed\/([^/?]+)/);
      if (embedMatch?.[1]) return embedMatch[1];
    }

    return null;
  } catch {
    return null;
  }
}

function buildYouTubeEmbed(url: string, startSec?: number | null, endSec?: number | null): string | null {
  const videoId = extractYouTubeVideoId(url);
  if (!videoId) return null;

  const params = new URLSearchParams({
    rel: "0",
    modestbranding: "1",
  });

  // start/end sono opzionali, ma se ci sono devono essere validi
  if (typeof startSec === "number" && Number.isFinite(startSec) && startSec >= 0) {
    params.set("start", String(Math.floor(startSec)));
  }
  if (typeof endSec === "number" && Number.isFinite(endSec) && endSec >= 0) {
    params.set("end", String(Math.floor(endSec)));
  }

  // se li hai entrambi, assicura end > start (altrimenti non mettere end)
  if (params.has("start") && params.has("end")) {
    const s = Number(params.get("start"));
    const e = Number(params.get("end"));
    if (!(e > s)) params.delete("end");
  }

  return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
}

function isDirectVideo(url: string) {
  return /\.(mp4|webm|ogg)(\?.*)?$/i.test(url);
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
        zIndex: 10000,
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
      >
        <div style={{ fontSize: 18, fontWeight: 950 }}>{title}</div>

        {description && (
          <div style={{ marginTop: 8, color: "#333", lineHeight: 1.35 }}>
            {description}
          </div>
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
            {loading ? "Invio..." : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function VotePage() {
  const router = useRouter();

  const [me, setMe] = useState<Me | null>(null);
  const [options, setOptions] = useState<Option[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [toast, setToast] = useState<string | null>(null);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingOption, setPendingOption] = useState<Option | null>(null);

  const [voting, setVoting] = useState(false);
  const [doneMsg, setDoneMsg] = useState<string | null>(null);

  const isLocked = !!me?.has_voted;

  // Toast timer 4s
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    (async () => {
      setErr(null);
      setLoading(true);

      try {
        const meRes = await fetch("/api/me");
        if (meRes.status === 401) {
          router.push("/");
          return;
        }
        const meJson = (await meRes.json()) as Me;
        setMe(meJson);

        const name = [meJson.first_name, meJson.last_name].filter(Boolean).join(" ");
        if (name) setToast(`Benvenuto ${name}`);

        const optRes = await fetch("/api/options");
        const optJson = await optRes.json();
        if (!optRes.ok || !optJson.ok) {
          setErr(optJson?.error ?? "Errore caricamento opzioni");
          return;
        }
        setOptions(optJson.options ?? []);
      } catch {
        setErr("Errore di rete");
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  const header = useMemo(() => {
    if (!me) return null;

    return (
      <div style={{ padding: 12, display: "grid", placeItems: "center" }}>
        <div
          style={{
            width: "100%",
            maxWidth: 620,
            background: "#ffffff",
            borderRadius: 18,
            padding: 14,
            border: "1px solid rgba(0,0,0,0.08)",
            boxShadow: "0 2px 14px rgba(0,0,0,0.10)",
            position: "relative",
          }}
        >
          {/* Badge arancione */}
          <div
            onClick={() => router.push("/admin")}
            style={{
              position: "absolute",
              top: -10,
              right: 14,
              background: "linear-gradient(90deg, #ffcc00, #ff7a00)",
              padding: "6px 10px",
              borderRadius: 999,
              fontWeight: 950,
              fontSize: 12,
              color: "#111",
              boxShadow: "0 8px 18px rgba(0,0,0,0.14)",
            }}
          >
            {me.team ?? "SQUADRA"}
          </div>

          <div style={{ fontWeight: 950, fontSize: 16, color: "#111" }}>
            {me.first_name || me.last_name ? `${me.first_name ?? ""} ${me.last_name ?? ""}`.trim() : "Utente"}
          </div>

          <div style={{ fontSize: 13, color: "#333", opacity: 0.9, marginTop: 2 }}>
            {me.email}
          </div>

          {/* Nascondo “PUÒ VOTARE”, mostro solo se già votato */}
          {}
        </div>
      </div>
    );
  }, [me]);

  function openConfirm(option: Option) {
    if (isLocked) return;
    setErr(null);
    setDoneMsg(null);
    setPendingOption(option);
    setConfirmOpen(true);
  }

  async function castVoteConfirmed() {
    if (!pendingOption) return;
    if (isLocked) {
      setConfirmOpen(false);
      return;
    }

    setVoting(true);
    setErr(null);
    setDoneMsg(null);

    try {
      const res = await fetch("/api/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ option_id: pendingOption.id }),
      });

      const json = await res.json();

      if (!res.ok || !json.ok) {
        setErr(json?.error ?? "Errore voto");
        return;
      }

      const meRes = await fetch("/api/me");
      const meJson = await meRes.json();
      setMe(meJson);

      setDoneMsg("Voto registrato. Ora sei in sola visualizzazione.");
      setConfirmOpen(false);
      setPendingOption(null);
    } catch {
      setErr("Errore di rete");
    } finally {
      setVoting(false);
    }
  }

  if (loading) {
    return (
      <main style={{ minHeight: "100vh", background: "#f2efe9" }}>
        <div
          style={{
            background: "#075e54",
            color: "white",
            padding: "14px 16px",
            fontWeight: 950,
            fontSize: 18,
            position: "sticky",
            top: 0,
            boxShadow: "0 2px 10px rgba(0,0,0,0.12)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span>Votazione</span>
          <img
            src="/logo.png"
            alt="Logo"
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              objectFit: "cover",
              boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
              border: "1px solid rgba(255,255,255,0.25)",
            }}
          />
        </div>

        <div style={{ padding: 16, maxWidth: 720, margin: "0 auto", color: "#111" }}>
          Caricamento…
        </div>
      </main>
    );
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at 12% 0%, rgba(255, 204, 0, 0.14), transparent 36%), radial-gradient(circle at 88% 10%, rgba(255, 122, 0, 0.12), transparent 40%), #f2efe9",
      }}
    >
      {/* Top bar */}
      <div
        style={{
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
        }}
      >
        <span>Votazione</span>

        {/* Logo top-right */}
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

      {/* Toast */}
      {toast && (
        <div
          style={{
            position: "fixed",
            top: 68,
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(17,17,17,0.92)",
            color: "white",
            padding: "10px 14px",
            borderRadius: 999,
            zIndex: 9999,
            fontWeight: 900,
            boxShadow: "0 6px 18px rgba(0,0,0,0.25)",
          }}
        >
          {toast}
        </div>
      )}

      <div style={{ maxWidth: 820, margin: "0 auto" }}>
        <div style={{ padding: "10px 16px", color: "#222", fontSize: 14, textAlign: "center" }}>
          Puoi votare una sola opzione. Non puoi votare un’opzione della tua squadra.
        </div>

        {header}

        {err && (
          <div style={{ padding: 12, display: "grid", placeItems: "center" }}>
            <div
              style={{
                width: "100%",
                maxWidth: 620,
                background: "#fff0f0",
                border: "1px solid rgba(200,0,0,0.2)",
                color: "#7a1010",
                borderRadius: 16,
                padding: 12,
                fontWeight: 900,
              }}
            >
              {err}
            </div>
          </div>
        )}

        {doneMsg && (
          <div style={{ padding: 12, display: "grid", placeItems: "center" }}>
            <div
              style={{
                width: "100%",
                maxWidth: 620,
                background: "#eaffea",
                border: "1px solid rgba(0,120,0,0.18)",
                color: "#0b3a17",
                borderRadius: 16,
                padding: 12,
                fontWeight: 950,
              }}
            >
              {doneMsg}
            </div>
          </div>
        )}

        {/* Cards centrati */}
        <div style={{ padding: 12, display: "grid", gap: 14, placeItems: "center" }}>
          {options.map((o) => {
            const isOwnTeam = !!me && o.team_id === me.team_id;
            const disabled = isLocked || voting || isOwnTeam;
            const yt = o.media_url ? buildYouTubeEmbed(o.media_url, o.start_sec, o.end_sec) : null;

            return (
              <div
                key={o.id}
                style={{
                  width: "100%",
                  maxWidth: 620,
                  background: "white",
                  borderRadius: 18,
                  padding: 14,
                  border: "1px solid rgba(0,0,0,0.08)",
                  boxShadow: "0 2px 14px rgba(0,0,0,0.10)",
                }}
              >
                {/* Titolo con accento giallo/arancio */}
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 999,
                      background: "linear-gradient(90deg, #ffcc00, #ff7a00)",
                      boxShadow: "0 4px 10px rgba(255, 140, 0, 0.25)",
                    }}
                  />
                  <div style={{ fontWeight: 950, fontSize: 16, color: "#111" }}>{o.name}</div>
                </div>

                <div style={{ fontSize: 13, color: "#333", marginTop: 4 }}>
                  <b>{o.team_name ?? `#${o.team_id}`}</b>
                  {me && o.team_id === me.team_id && (
                    <span style={{ marginLeft: 8, fontWeight: 900, color: "#d97b00" }}>
                      (la tua squadra)
                    </span>
                  )}
                </div>

                {o.media_url && (
                  <div style={{ marginTop: 10 }}>
                    {yt ? (
                      <iframe
                        src={yt}
                        style={{
                          width: "100%",
                          height: 240,
                          borderRadius: 14,
                          border: 0,
                          background: "#000",
                        }}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    ) : isDirectVideo(o.media_url) ? (
                      <video
                        src={o.media_url}
                        controls
                        style={{ width: "100%", borderRadius: 14 }}
                      />
                    ) : (
                      <a href={o.media_url} target="_blank" rel="noreferrer" style={{ color: "#075e54", fontWeight: 900 }}>
                        Apri video/clip
                      </a>
                    )}
                  </div>
                )}

                <button
                  disabled={disabled}
                  onClick={() => openConfirm(o)}
                  style={{
                    marginTop: 12,
                    width: "100%",
                    padding: 12,
                    borderRadius: 14,
                    border: "none",
                    background: disabled
                      ? "#d9d9d9"
                      : "linear-gradient(90deg, #25d366, #ffcc00)",
                    color: "#111",
                    fontWeight: 950,
                    cursor: disabled ? "not-allowed" : "pointer",
                    opacity: disabled ? 0.7 : 1,
                  }}
                >
                  {isLocked ? "Hai già votato" : isOwnTeam ? "Non puoi votare la tua squadra" : "Vota"}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <ConfirmModal
        open={confirmOpen}
        title="Confermi il voto?"
        description={
          pendingOption
            ? `Stai per votare: "${pendingOption.name}". Dopo la conferma non potrai cambiare voto.`
            : undefined
        }
        confirmText="Conferma voto"
        cancelText="Annulla"
        loading={voting}
        onCancel={() => {
          if (voting) return;
          setConfirmOpen(false);
          setPendingOption(null);
        }}
        onConfirm={castVoteConfirmed}
      />
    </main>
  );
}
