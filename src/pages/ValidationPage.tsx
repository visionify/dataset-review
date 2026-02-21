import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/api";
import type { ValidationCheck } from "@/types";

export default function ValidationPage() {
  const [checks, setChecks] = useState<ValidationCheck[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    api
      .getValidation()
      .then((r) => setChecks(r.checks ?? []))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p style={{ color: "var(--color-text-muted)" }}>Loading validation…</p>;
  if (error) return <p style={{ color: "var(--color-danger)" }}>{error}</p>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
        <h1 style={{ fontSize: "1.5rem" }}>Dataset validation</h1>
        <Link to="/" className="btn btn-ghost">← Classes</Link>
      </div>
      <p style={{ color: "var(--color-text-muted)", fontSize: "0.95rem" }}>
        Run these checks before training to catch missing labels, empty labels, and class balance.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {checks.map((c) => (
          <div
            key={c.id}
            className="card"
            style={{
              padding: "1rem",
              borderLeftWidth: "4px",
              borderLeftColor:
                c.severity === "ok"
                  ? "var(--color-success)"
                  : c.severity === "warning"
                    ? "var(--color-warning)"
                    : "var(--color-text-muted)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem", flexWrap: "wrap", gap: "0.5rem" }}>
              <h2 style={{ fontSize: "1rem", fontWeight: 600 }}>{c.name}</h2>
              <span
                style={{
                  fontSize: "0.85rem",
                  padding: "0.2rem 0.5rem",
                  borderRadius: "var(--radius-sm)",
                  background:
                    c.severity === "ok"
                      ? "oklch(0.55 0.18 145 / 0.2)"
                      : c.severity === "warning"
                        ? "oklch(0.75 0.15 85 / 0.2)"
                        : "oklch(0 0 0 / 0.06)",
                }}
              >
                {c.count}
              </span>
            </div>
            {Array.isArray(c.detail) && c.detail.length > 0 && (
              <ul style={{ fontSize: "0.85rem", color: "var(--color-text-muted)", marginTop: "0.5rem", paddingLeft: "1.25rem" }}>
                {c.detail.slice(0, 15).map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
                {(c.detail as string[]).length > 15 && (
                  <li>… and {(c.detail as string[]).length - 15} more</li>
                )}
              </ul>
            )}
            {!Array.isArray(c.detail) && typeof c.detail === "object" && c.detail !== null && (
              <div style={{ fontSize: "0.85rem", color: "var(--color-text-muted)", marginTop: "0.5rem", display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                {Object.entries(c.detail).map(([k, v]) => (
                  <span key={k} style={{ padding: "0.2rem 0.4rem", background: "oklch(0 0 0 / 0.06)", borderRadius: "var(--radius-sm)" }}>
                    {k}: {String(v)}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
