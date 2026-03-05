import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { api } from "@/api";
import type { ValidationCheck, ImageItem } from "@/types";

const ITEMS_PER_PAGE = 48;

interface DupItem extends ImageItem { dupCount?: number; smallCount?: number; hash?: string; originalName?: string; originalSplit?: string }

export default function ValidationPage() {
  const [checks, setChecks] = useState<ValidationCheck[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pages, setPages] = useState<Record<string, number>>({});
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [acting, setActing] = useState(false);

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

  const handleFixDuplicates = async () => {
    setActing(true); setActionMsg(null);
    try {
      const r = await api.fixDuplicateLabels();
      setActionMsg(`Fixed ${r.filesFixed} files, removed ${r.linesRemoved} duplicate lines.`);
      loadChecks();
    } catch (e) { setActionMsg(e instanceof Error ? e.message : "Failed"); }
    finally { setActing(false); setTimeout(() => setActionMsg(null), 5000); }
  };

  const handleDeleteMissingLabels = async () => {
    const count = checks.find(c => c.id === "missing_labels")?.count ?? 0;
    if (!count) return;
    if (!window.confirm(`Delete ${count} images that have no label file? This cannot be undone.`)) return;
    setActing(true); setActionMsg(null);
    try {
      const r = await api.deleteMissingLabelImages();
      setActionMsg(`Deleted ${r.deleted} images.`);
      loadChecks();
    } catch (e) { setActionMsg(e instanceof Error ? e.message : "Failed"); }
    finally { setActing(false); setTimeout(() => setActionMsg(null), 5000); }
  };

  const handleDeleteDuplicateImages = async () => {
    const count = checks.find(c => c.id === "duplicate_images")?.count ?? 0;
    if (!count) return;
    if (!window.confirm(`Delete ${count} duplicate images (and their labels)? The first occurrence of each image will be kept. This cannot be undone.`)) return;
    setActing(true); setActionMsg(null);
    try {
      const r = await api.deleteDuplicateImages();
      setActionMsg(`Removed ${r.deleted} duplicate images.`);
      loadChecks();
    } catch (e) { setActionMsg(e instanceof Error ? e.message : "Failed"); }
    finally { setActing(false); setTimeout(() => setActionMsg(null), 5000); }
  };

  const handleDeleteSmallBboxes = async () => {
    const count = checks.find(c => c.id === "small_bboxes")?.count ?? 0;
    if (!count) return;
    if (!window.confirm(`Remove ${count} bbox(es) that are smaller than 0.1% of image area across all label files? This cannot be undone.`)) return;
    setActing(true); setActionMsg(null);
    try {
      const r = await api.deleteSmallBboxes();
      setActionMsg(`Removed ${r.removed} small bbox(es) from ${r.filesUpdated} file(s).`);
      loadChecks();
    } catch (e) { setActionMsg(e instanceof Error ? e.message : "Failed"); }
    finally { setActing(false); setTimeout(() => setActionMsg(null), 5000); }
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
        Run these checks before training to catch missing labels, empty labels, duplicates, and class balance.
      </p>

      {actionMsg && <div style={{ padding: "0.5rem 0.75rem", background: "oklch(0.55 0.18 145 / 0.15)", borderRadius: "var(--radius-sm)", fontSize: "0.9rem" }}>{actionMsg}</div>}

      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {checks.map((c) => {
          const isImageList = (c.id === "missing_labels" || c.id === "empty_labels" || c.id === "duplicate_labels" || c.id === "duplicate_images" || c.id === "small_bboxes") && Array.isArray(c.detail);
          const isExpanded = expandedId === c.id;
          const imageItems: DupItem[] = isImageList ? (c.detail as DupItem[]) : [];
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
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  {/* Action buttons */}
                  {c.id === "duplicate_labels" && c.count > 0 && (
                    <button
                      className="btn btn-primary"
                      style={{ padding: "0.25rem 0.6rem", fontSize: "0.85rem" }}
                      onClick={(e) => { e.stopPropagation(); handleFixDuplicates(); }}
                      disabled={acting}
                    >
                      {acting ? "Fixing…" : "Remove all duplicates"}
                    </button>
                  )}
                  {c.id === "missing_labels" && c.count > 0 && (
                    <button
                      className="btn btn-ghost"
                      style={{ padding: "0.25rem 0.6rem", fontSize: "0.85rem", color: "var(--color-danger)" }}
                      onClick={(e) => { e.stopPropagation(); handleDeleteMissingLabels(); }}
                      disabled={acting}
                    >
                      {acting ? "Deleting…" : `Delete all ${c.count} images`}
                    </button>
                  )}
                  {c.id === "duplicate_images" && c.count > 0 && (
                    <button
                      className="btn btn-ghost"
                      style={{ padding: "0.25rem 0.6rem", fontSize: "0.85rem", color: "var(--color-danger)" }}
                      onClick={(e) => { e.stopPropagation(); handleDeleteDuplicateImages(); }}
                      disabled={acting}
                    >
                      {acting ? "Deleting…" : `Remove ${c.count} duplicates`}
                    </button>
                  )}
                  {c.id === "small_bboxes" && c.count > 0 && (
                    <button
                      className="btn btn-ghost"
                      style={{ padding: "0.25rem 0.6rem", fontSize: "0.85rem", color: "var(--color-danger)" }}
                      onClick={(e) => { e.stopPropagation(); handleDeleteSmallBboxes(); }}
                      disabled={acting}
                    >
                      {acting ? "Removing…" : `Delete all small bboxes (${c.count})`}
                    </button>
                  )}
                  <span
                    style={{
                      fontSize: "0.85rem", padding: "0.2rem 0.5rem", borderRadius: "var(--radius-sm)",
                      background: c.severity === "ok" ? "oklch(0.55 0.18 145 / 0.2)" : c.severity === "warning" ? "oklch(0.75 0.15 85 / 0.2)" : "oklch(0 0 0 / 0.06)",
                    }}
                  >
                    {c.count}
                  </span>
                </div>
              </div>

              {/* Extra info for duplicates */}
              {c.id === "duplicate_labels" && c.count > 0 && (c as any).extra?.totalDupLines && (
                <p style={{ fontSize: "0.85rem", color: "var(--color-text-muted)", marginBottom: "0.25rem" }}>
                  {(c as any).extra.totalDupLines} total duplicate lines across {c.count} files
                </p>
              )}
              {c.id === "duplicate_images" && c.count > 0 && (
                <p style={{ fontSize: "0.85rem", color: "var(--color-text-muted)", marginBottom: "0.25rem" }}>
                  {c.count} duplicate images found (first occurrence of each will be kept)
                </p>
              )}
              {c.id === "small_bboxes" && c.count > 0 && (
                <p style={{ fontSize: "0.85rem", color: "var(--color-text-muted)", marginBottom: "0.25rem" }}>
                  {c.count} bbox(es) smaller than 0.1% of image area — remove in one go or open images to review.
                </p>
              )}

              {/* Image grid for missing/empty/duplicate labels */}
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
                            {img.dupCount != null && <span style={{ marginLeft: "0.25rem", color: "var(--color-warning)" }}>({img.dupCount} dup)</span>}
                            {img.smallCount != null && <span style={{ marginLeft: "0.25rem", color: "var(--color-danger)" }}>({img.smallCount} small)</span>}
                            {img.originalName && <span style={{ marginLeft: "0.25rem", color: "var(--color-warning)" }} title={`Original: ${img.originalSplit}/${img.originalName}`}>⇒ dup</span>}
                          </div>
                        </Link>
                        {c.id !== "duplicate_labels" && c.id !== "duplicate_images" && c.id !== "small_bboxes" && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleDelete(img, c.id); }}
                            style={{ position: "absolute", top: 4, right: 4, background: "rgba(239,68,68,0.85)", color: "#fff", border: "none", borderRadius: "50%", width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.75rem", cursor: "pointer", fontWeight: 700 }}
                            title="Delete image"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Class distribution table */}
              {c.id === "class_balance" && typeof c.detail === "object" && c.detail !== null && !Array.isArray(c.detail) && (
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
