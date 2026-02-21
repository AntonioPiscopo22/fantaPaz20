"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  media_url: string | null; // URL del video originale (watch?v=... o youtu.be/...)
  start_sec: number | null; // inizio in secondi (es: 42)
  end_sec: number | null; // fine in secondi (es: 57)
  team_id: number;
  team_name: string | null;
};

function extractYouTubeVideoId(url: string): string | null {
  try {
    const u = new URL(url);

    if (u.hostname.includes("youtu.be")) {
      const id = u.pathname.split("/").filter(Boolean)[0];
      return id || null;
    }

    if (u.hostname.includes("youtube.com")) {
      const v = u.searchParams.get("v");
      if (v) return v;

      const embedMatch = u.pathname.match(/\/embed\/([^/?]+)/);
      if (embedMatch?.[1]) return embedMatch[1];
    }

    return null;
  } catch {
    return null;
  }
}

function isDirectVideo(url: string) {
  return /\.(mp4|webm|ogg)(\?.*)?$/i.test(url);
}

/** ---------- YouTube IFrame API loader ---------- */
declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

function loadYouTubeIframeAPI(): Promise<void> {
  return new Promise((resolve) => {
    if (window.YT && window.YT.Player) return resolve();

    // evita doppio script
    const existing = document.querySelector('script[data-yt-iframe-api="1"]') as HTMLScriptElement | null;
    if (existing) {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        prev?.();
        resolve();
      };
      return;
    }

    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    tag.async = true;
    tag.dataset.ytIframeApi = "1";

    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve();
    };

    document.head.appendChild(tag);
  });
}

/**
 * ClipYouTube controllato:
 * - usa YT.Player (enablejsapi)
 * - NO containerId: usa ref DOM per evitare collisioni tra player
 * - bottone "Ricarica" => seekTo(start) + play
 * - quando arriva a end: torna a start e pausa (NO reset durante la visione, NO loop automatico)
 */
function ClipYouTube({
  url,
  startSec,
  endSec,
  height = 240,
  onApi,
}: {
  url: string;
  startSec: number | null;
  endSec: number | null;
  height?: number;
  onApi?: (api: { replayFromStart: () => void }) => void;
}) {
  const videoId = useMemo(() => (url ? extractYouTubeVideoId(url) : null), [url]);

  // ✅ QUI: ref al container DOM (niente id)
  const containerRef = useRef<HTMLDivElement | null>(null);

  const playerRef = useRef<any>(null);
  const intervalRef = useRef<number | null>(null);

  const safeStart =
    typeof startSec === "number" && Number.isFinite(startSec) && startSec >= 0 ? Math.floor(startSec) : null;

  const safeEnd =
    typeof endSec === "number" && Number.isFinite(endSec) && endSec >= 0 ? Math.floor(endSec) : null;

  const hasClip =
    typeof safeStart === "number" &&
    typeof safeEnd === "number" &&
    Number.isFinite(safeStart) &&
    Number.isFinite(safeEnd) &&
    safeEnd > safeStart;

  const replayFromStart = useCallback(() => {
    const p = playerRef.current;
    if (!p) return;

    if (typeof safeStart === "number") {
      p.seekTo(safeStart, true);
    }
    p.playVideo?.();
  }, [safeStart]);

  // crea/distrugge il player quando cambia videoId
  useEffect(() => {
    if (!videoId) return;
    if (!containerRef.current) return;

    let cancelled = false;

    (async () => {
      await loadYouTubeIframeAPI();
      if (cancelled) return;
      if (!containerRef.current) return;

      // se esiste già, distruggi
      if (playerRef.current?.destroy) {
        playerRef.current.destroy();
        playerRef.current = null;
      }

      // ✅ QUI: passiamo l'elemento DOM, non una stringa id
      playerRef.current = new window.YT.Player(containerRef.current, {
        height,
        width: "100%",
        videoId,
        playerVars: {
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
          enablejsapi: 1,
          autoplay: 0,
          ...(typeof safeStart === "number" ? { start: safeStart } : {}),
          ...(hasClip ? { end: safeEnd as number } : {}),
        },
        events: {
          onReady: () => {
            const p = playerRef.current;
            if (!p) return;
                    
            try {
              // Carica il video SENZA farlo partire (cue = prepara, non autoplay)
              if (typeof safeStart === "number") {
                p.cueVideoById({
                  videoId,
                  startSeconds: safeStart,
                  ...(hasClip && typeof safeEnd === "number" ? { endSeconds: safeEnd } : {}),
                });
              } else {
                p.cueVideoById({ videoId });
              }
            
              // Doppia sicurezza: resta fermo
              p.pauseVideo?.();
            
              // (opzionale ma utile) Riporta esattamente allo start, senza play
              if (typeof safeStart === "number") {
                p.seekTo(safeStart, true);
                p.pauseVideo?.();
              }
            } catch {
              // se l'API non è pronta o l'operazione fallisce, non facciamo crashare nulla
            }
          
            // Espone l'API al parent (per il bottone "Ricarica")
            onApi?.({ replayFromStart });
          },
          onStateChange: (e: any) => {
            const state = e?.data;

            // 1 = PLAYING, 2 = PAUSED, 0 = ENDED
            if (state === 1) {
              if (hasClip) {
                if (intervalRef.current) window.clearInterval(intervalRef.current);
                intervalRef.current = window.setInterval(() => {
                  const p = playerRef.current;
                  if (!p) return;
                  const t = Number(p.getCurrentTime?.() ?? 0);

                  if (typeof safeEnd === "number" && t >= safeEnd) {
                    try {
                      p.pauseVideo?.();
                      if (typeof safeStart === "number") p.seekTo(safeStart, true);
                    } catch {}
                  }
                }, 250);
              }
            } else if (state === 2 || state === 0) {
              if (intervalRef.current) {
                window.clearInterval(intervalRef.current);
                intervalRef.current = null;
              }

              if (state === 0 && typeof safeStart === "number") {
                try {
                  playerRef.current.seekTo(safeStart, true);
                  playerRef.current.pauseVideo?.();
                } catch {}
              }
            }
          },
        },
      });
    })();

    return () => {
      cancelled = true;
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (playerRef.current?.destroy) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
    };
  }, [videoId, height, safeStart, safeEnd, hasClip, onApi, replayFromStart]);

  if (!videoId) return null;

  return (
    <div
      style={{
        width: "100%",
        height,
        borderRadius: 14,
        overflow: "hidden",
        background: "#000",
      }}
    >
      {/* ✅ div “vuoto” che diventa iframe */}
      <div ref={containerRef} />
    </div>
  );
}

function IconReplay({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M21 12a9 9 0 0 1-15.3 6.4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M3 12a9 9 0 0 1 15.3-6.4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M7 17H5v-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M17 7h2v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function OptionCard({
  o,
  me,
  isLocked,
  voting,
  onVote,
}: {
  o: Option;
  me: Me | null;
  isLocked: boolean;
  voting: boolean;
  onVote: (o: Option) => void;
}) {
  const isOwnTeam = !!me && o.team_id === me.team_id;
  const disabled = isLocked || voting || isOwnTeam;

  const isYoutube = !!(o.media_url && extractYouTubeVideoId(o.media_url));

  // API del player per il tasto Ricarica (niente rimontaggi)
  const playerApiRef = useRef<{ replayFromStart: () => void } | null>(null);

  return (
    <div
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
      {/* Header: titolo+squadra + bottone a destra */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: 999,
                background: "linear-gradient(90deg, #ffcc00, #ff7a00)",
                boxShadow: "0 4px 10px rgba(255, 140, 0, 0.25)",
                flexShrink: 0,
              }}
            />
            <div
              style={{
                fontWeight: 950,
                fontSize: 16,
                color: "#111",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {o.name}
            </div>
          </div>

          <div style={{ fontSize: 13, color: "#333", marginTop: 4 }}>
            <b>{o.team_name ?? `#${o.team_id}`}</b>
            {me && o.team_id === me.team_id && (
              <span style={{ marginLeft: 8, fontWeight: 900, color: "#d97b00" }}>(la tua squadra)</span>
            )}
          </div>
        </div>

        {/*
          Bottone ricarica in alto a destra (commentato)
          {isYoutube && (
            <button
              type="button"
              onClick={() => playerApiRef.current?.replayFromStart()}
              ...
            >
              <IconReplay />
              Ricarica
            </button>
          )}
        */}
      </div>

      {/* Media */}
      {o.media_url && (
        <div style={{ marginTop: 10 }}>
          {isYoutube ? (
            <ClipYouTube
              url={o.media_url}
              startSec={o.start_sec}
              endSec={o.end_sec}
              height={240}
              onApi={(api) => {
                playerApiRef.current = api;
              }}
            />
          ) : isDirectVideo(o.media_url) ? (
            <video src={o.media_url} controls style={{ width: "100%", borderRadius: 14 }} />
          ) : (
            <a href={o.media_url} target="_blank" rel="noreferrer" style={{ color: "#075e54", fontWeight: 900 }}>
              Apri video/clip
            </a>
          )}
        </div>
      )}

      <button
        disabled={disabled}
        onClick={() => onVote(o)}
        style={{
          marginTop: 12,
          width: "100%",
          padding: 12,
          borderRadius: 14,
          border: "none",
          background: disabled ? "#d9d9d9" : "linear-gradient(90deg, #25d366, #ffcc00)",
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

        {description && <div style={{ marginTop: 8, color: "#333", lineHeight: 1.35 }}>{description}</div>}

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
              cursor: "pointer",
            }}
          >
            {me.team ?? "SQUADRA"}
          </div>

          <div style={{ fontWeight: 950, fontSize: 16, color: "#111" }}>
            {me.first_name || me.last_name ? `${me.first_name ?? ""} ${me.last_name ?? ""}`.trim() : "Utente"}
          </div>

          <div style={{ fontSize: 13, color: "#333", opacity: 0.9, marginTop: 2 }}>{me.email}</div>
        </div>
      </div>
    );
  }, [me, router]);

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

        <div style={{ padding: 16, maxWidth: 720, margin: "0 auto", color: "#111" }}>Caricamento…</div>
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

        <div style={{ padding: 12, display: "grid", gap: 14, placeItems: "center" }}>
          {options.map((o) => (
            <OptionCard key={o.id} o={o} me={me} isLocked={isLocked} voting={voting} onVote={openConfirm} />
          ))}
        </div>
      </div>

      <ConfirmModal
        open={confirmOpen}
        title="Confermi il voto?"
        description={
          pendingOption ? `Stai per votare: "${pendingOption.name}". Dopo la conferma non potrai cambiare voto.` : undefined
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