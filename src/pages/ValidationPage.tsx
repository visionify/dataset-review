import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { api } from "@/api";
import type { ValidationCheck, ImageItem } from "@/types";

const ITEMS_PER_PAGE = 48;

export default function ValidationPage() {
  const [checks, setChecks] = useState<ValidationCheck[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pages, setPages] = useState<Record<string, number>>({});

  const loadChecks = useCallback(() => {
    setLoading(true);
    api
      .getValidation()
      .then((r) => setChecks(r.checks ?? []))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadChecks(); }, [loadChecks]);

  const handleDelete = async (img: ImageItem, checkId: string) => {
    if (!window.confirm(`Delete ${img.name} and its label from the dataset?`)) return;
    try {
      await api.deleteImage(img.split, img.name);
      setChecks(prev => prev.map(c => {
        if (c.id !== checkId || !Array.isArray(c.detail)) return c;
        const filtered = (c.detail as unknown as ImageItem[]).filter(d => !(d.split === img.split && d.name === img.name));
        return { ...c, count: filtered.length, detail: filtered, severity: filtered.length ? c.severity : "ok" };
      }));
    } catch {}
  };

  if (loading) return <p style={{ color: "var(--color-text-muted)" }}>Loading validation…</p>;
  if (error) return <p style={{ color: "var(--color-danger)" }}>{error}</p>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
        <h1 style={{ fontSize: "1.5rem" }}>Validation checks</h1>
        <Link to="/" className="btn btn-ghost">← Dashboard</Link>
      </div>
      <p style={{ color: "var(--color-text-muted)", fontSize: "0.95rem" }}>
        Run these checks before training to catch missing labels, empty labels, and class balance.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {checks.map((c) => {
          const isImageList = (c.id === "missing_labels" || c.id === "empty_labels") && Array.isArray(c.detail);
          const isExpanded = expandedId === c.id;
          const imageItems: ImageItem[] = isImageList ? (c.detail as ImageItem[]) : [];
          const currentPage = pages[c.id] ?? 0;
          const totalPages = Math.max(1, Math.ceil(imageItems.length / ITEMS_PER_PAGE));
          const pageItems = imageItems.slice(currentPage * ITEMS_PER_PAGE, (currentPage + 1) * ITEMS_PER_PAGE);

          return (
            <div
              key={c.id}
              className="card"
              style={{
                padding: "1rem",
                borderLeftWidth: "4px",
                borderLeftColor: c.severity === "ok" ? "var(--color-success)" : c.severity === "warning" ? "var(--color-warning)" : "var(--color-text-muted)",
              }}
            >
              <div
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem", flexWrap: "wrap", gap: "0.5rem", cursor: isImageList && c.count > 0 ? "pointer" : undefined }}
                onClick={() => isImageList && c.count > 0 && setExpandedId(isExpanded ? null : c.id)}
              >
                <h2 style={{ fontSize: "1rem", fontWeight: 600 }}>
                  {c.name}
                  {isImageList && c.count > 0 && <span style={{ marginLeft: "0.5rem", fontSize: "0.85rem", color: "var(--color-text-muted)" }}>{isExpanded ? "▼" : "▶"}</span>}
                </h2>
                <span
                  style={{
                    fontSize: "0.85rem", padding: "0.2rem 0.5rem", borderRadius: "var(--radius-sm)",
                    background: c.severity === "ok" ? "oklch(0.55 0.18 145 / 0.2)" : c.severity === "warning" ? "oklch(0.75 0.15 85 / 0.2)" : "oklch(0 0 0 / 0.06)",
                  }}
                >
                  {c.count}
                </span>
              </div>

              {/* Image grid for missing/empty labels */}
              {isImageList && isExpanded && imageItems.length > 0 && (
                <div style={{ marginTop: "0.75rem" }}>
                  {totalPages > 1 && (
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                      <button className="btn btn-ghost" disabled={currentPage === 0} onClick={(e) => { e.stopPropagation(); setPages(p => ({ ...p, [c.id]: currentPage - 1 })); }}>Prev</button>
                      <span style={{ fontSize: "0.85rem", color: "var(--color-text-muted)" }}>Page {currentPage + 1} / {totalPages}</span>
                      <button className="btn btn-ghost" disabled={currentPage >= totalPages - 1} onClick={(e) => { e.stopPropagation(); setPages(p => ({ ...p, [c.id]: currentPage + 1 })); }}>Next</button>
                    </div>
                  )}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "0.5rem" }}>
                    {pageItems.map((img) => (
                      <div key={`${img.split}/${img.name}`} className="card" style={{ padding: 0, overflow: "hidden", position: "relative" }}>
                        <Link
                          to={`/image/${encodeURIComponent(img.split)}/${encodeURIComponent(img.name)}`}
                          state={{ fromSplit: img.split }}
                          style={{ textDecoration: "none", color: "inherit" }}
                        >
                          <div style={{ aspectRatio: "1", background: "var(--color-border)" }}>
                            <img src={api.imageUrl(img.split, img.name)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} loading="lazy" />
                          </div>
                          <div style={{ padding: "0.25rem 0.4rem", fontSize: "0.7rem", color: "var(--color-text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {img.name}
                          </div>
                        </Link>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleDelete(img, c.id); }}
                          style={{ position: "absolute", top: 4, right: 4, background: "rgba(239,68,68,0.85)", color: "#fff", border: "none", borderRadius: "50%", width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.75rem", cursor: "pointer", fontWeight: 700 }}
                          title="Delete image"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Class distribution table */}
              {!isImageList && typeof c.detail === "object" && c.detail !== null && (
                <div style={{ fontSize: "0.85rem", color: "var(--color-text-muted)", marginTop: "0.5rem", display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                  {Object.entries(c.detail).map(([k, v]) => (
                    <span key={k} style={{ padding: "0.2rem 0.4rem", background: "oklch(0 0 0 / 0.06)", borderRadius: "var(--radius-sm)" }}>
                      {k}: {String(v)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
