"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const json = await res.json();

      if (!res.ok || !json.ok) {
        setErr(json?.error ?? "Errore login");
        return;
      }

      router.push("/vote");
    } catch {
      setErr("Errore di rete");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ minHeight: "100vh", background: "#e5ddd5" }}>
      {/* Top bar */}
      <div
        style={{
          background: "#075e54",
          color: "white",
          padding: "14px 16px",
          fontWeight: 900,
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
        <span>Accesso</span>

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

      <div style={{ maxWidth: 520, margin: "0 auto", padding: 16 }}>
        <div
          style={{
            background: "rgba(255,255,255,0.92)",
            border: "1px solid rgba(0,0,0,0.06)",
            borderRadius: 16,
            padding: 16,
            boxShadow: "0 1px 10px rgba(0,0,0,0.08)",
          }}
        >
          {/* TESTI PIÙ VISIBILI */}
          <div style={{ fontWeight: 900, marginBottom: 8, color: "#111", fontSize: 18 }}>
            Inserisci la tua email
          </div>
          <div style={{ fontSize: 14, color: "#2b2b2b", lineHeight: 1.35 }}>
            Se la mail è in lista, entri automaticamente con la squadra associata.
          </div>

          <form onSubmit={onSubmit} style={{ marginTop: 14, display: "grid", gap: 10 }}>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@example.com"
              inputMode="email"
              style={{
                padding: 12,
                borderRadius: 12,
                border: "1px solid rgba(0,0,0,0.18)",
                fontSize: 16,
                outline: "none",
                background: "white",
                color: "#111",
              }}
            />

            <button
              type="submit"
              disabled={loading}
              style={{
                padding: 12,
                borderRadius: 12,
                border: "none",
                background: "#25d366",
                color: "#062b22",
                fontSize: 16,
                fontWeight: 900,
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? "Accesso..." : "Entra"}
            </button>

            {err && (
              <div
                style={{
                  padding: 12,
                  borderRadius: 12,
                  background: "#fff0f0",
                  border: "1px solid rgba(200,0,0,0.2)",
                  color: "#7a1010",
                  fontWeight: 800,
                }}
              >
                {err}
              </div>
            )}
          </form>
        </div>
      </div>
    </main>
  );
}
