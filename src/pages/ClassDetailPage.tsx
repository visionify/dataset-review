import { useEffect, useState, useCallback } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { api } from "@/api";
import { ClassGalleryView } from "@/components/ClassGalleryView";
import type { ClassItem, ImageItem } from "@/types";

const PAGE_SIZE = 50;

type SortMode = "" | "area_asc" | "area_desc";

export default function ClassDetailPage() {
  const { classId } = useParams<{ classId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [images, setImages] = useState<ImageItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"grid" | "list" | "gallery">("grid");

  const sortBy = (searchParams.get("sort") || "") as SortMode;
  const setSortBy = (v: SortMode) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (v) next.set("sort", v); else next.delete("sort");
      return next;
    }, { replace: true });
  };

  const id = classId ? parseInt(classId, 10) : NaN;

  useEffect(() => {
    api.getSummary().then((s) => setClasses(s.classes ?? [])).catch(() => {});
  }, []);

  // Reset to page 1 when sort changes
  useEffect(() => { setPage(1); }, [sortBy]);

  const loadPage = useCallback(() => {
    if (!classId || isNaN(id)) return;
    setLoading(true);
    api
      .getClassImages(id, page, PAGE_SIZE, sortBy || undefined)
      .then((r) => { setImages(r.images); setTotal(r.total); })
      .finally(() => setLoading(false));
  }, [classId, id, page, sortBy]);

  useEffect(() => { loadPage(); }, [loadPage]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const cls = classes.find((c) => c.id === id);

  if (!classId) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.75rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
          <Link to="/" className="btn btn-ghost" style={{ padding: "0.35rem 0.5rem" }}>
            ← Classes
          </Link>
          <span style={{ color: "var(--color-text-muted)", fontSize: "0.9rem" }}>/</span>
          <h1 style={{ fontSize: "1.35rem", fontWeight: 600 }}>{cls?.name ?? `Class ${classId}`}</h1>
          <span style={{ color: "var(--color-text-muted)", fontSize: "0.9rem" }}>{total} images</span>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <select
            className="input"
            style={{ width: "auto", padding: "0.3rem 0.4rem", fontSize: "0.85rem" }}
            value={sortBy}
            onChange={e => setSortBy(e.target.value as SortMode)}
          >
            <option value="">Default order</option>
            <option value="area_asc">BBox area (smallest first)</option>
            <option value="area_desc">BBox area (largest first)</option>
          </select>
          <button className={`btn ${viewMode === "grid" ? "btn-primary" : "btn-ghost"}`} onClick={() => setViewMode("grid")}>Grid</button>
          <button className={`btn ${viewMode === "list" ? "btn-primary" : "btn-ghost"}`} onClick={() => setViewMode("list")}>List</button>
          <button className={`btn ${viewMode === "gallery" ? "btn-primary" : "btn-ghost"}`} onClick={() => setViewMode("gallery")}>Gallery</button>
        </div>
      </div>

      {viewMode === "gallery" ? (
        <ClassGalleryView
          classId={classId}
          classIdNum={id}
          classes={classes}
          totalImages={total}
        />
      ) : loading ? (
        <p style={{ color: "var(--color-text-muted)" }}>Loading…</p>
      ) : (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: viewMode === "grid" ? "repeat(auto-fill, minmax(200px, 1fr))" : "1fr",
              gap: "0.5rem",
            }}
          >
            {images.map((img, idx) => (
              <Link
                key={img.imageRel}
                to={`/image/${encodeURIComponent(img.split)}/${encodeURIComponent(img.name)}`}
                state={{ classId, classSort: sortBy || undefined, startIndex: (page - 1) * PAGE_SIZE + idx }}
                className="card"
                style={{
                  padding: viewMode === "list" ? "0.5rem 0.75rem" : 0,
                  display: "flex",
                  flexDirection: viewMode === "list" ? "row" : "column",
                  alignItems: viewMode === "list" ? "center" : undefined,
                  gap: viewMode === "list" ? "1rem" : 0,
                  textDecoration: "none",
                  color: "inherit",
                  position: "relative",
                }}
              >
                <div style={{ aspectRatio: "1", minWidth: viewMode === "list" ? 80 : undefined, background: "var(--color-border)", borderRadius: "var(--radius-sm)", overflow: "hidden" }}>
                  <img
                    src={api.imageUrl(img.split, img.name)}
                    alt=""
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    loading="lazy"
                  />
                </div>
                {img.bboxArea != null && (
                  <span style={{
                    position: "absolute", bottom: viewMode === "list" ? "auto" : 4, right: 4, top: viewMode === "list" ? 4 : "auto",
                    background: img.bboxArea < 0.001 ? "rgba(239,68,68,0.85)" : img.bboxArea < 0.005 ? "rgba(234,179,8,0.85)" : "rgba(0,0,0,0.55)",
                    color: "#fff", fontSize: "0.65rem", padding: "1px 4px", borderRadius: 3, fontVariantNumeric: "tabular-nums",
                  }}>
                    {(img.bboxArea * 100).toFixed(2)}%
                  </span>
                )}
                {viewMode === "list" && (
                  <span style={{ fontSize: "0.9rem", color: "var(--color-text-muted)" }}>
                    {img.name}
                    {img.bboxArea != null && <span style={{ marginLeft: "0.5rem", fontSize: "0.8rem", color: img.bboxArea < 0.001 ? "var(--color-danger)" : "var(--color-text-muted)" }}>area: {(img.bboxArea * 100).toFixed(3)}%</span>}
                  </span>
                )}
              </Link>
            ))}
          </div>

          {totalPages > 1 && (
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", justifyContent: "center" }}>
              <button className="btn btn-ghost" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                ← Previous
              </button>
              <span style={{ fontSize: "0.9rem", color: "var(--color-text-muted)", fontVariantNumeric: "tabular-nums" }}>
                Page {page} of {totalPages}
              </span>
              <button className="btn btn-ghost" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
