import { useEffect, useState, useCallback } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { api, imageSrc } from "@/api";
import { ClassGalleryView } from "@/components/ClassGalleryView";
import type { ClassItem, ImageItem } from "@/types";

const PAGE_SIZE = 50;

type SortMode = "" | "area_asc" | "area_desc" | "size_asc" | "size_desc";

export default function ClassDetailPage() {
  const { classId } = useParams<{ classId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [images, setImages] = useState<ImageItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"grid" | "list" | "gallery">("grid");
  const [datasetType, setDatasetType] = useState<string>("detection");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [moveTarget, setMoveTarget] = useState("");
  const [moving, setMoving] = useState(false);

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
    api.getSummary().then((s) => {
      setClasses(s.classes ?? []);
      setDatasetType(s.type ?? "detection");
    }).catch(() => {});
  }, []);

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
  useEffect(() => { setSelected(new Set()); }, [page, sortBy]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const cls = classes.find((c) => c.id === id);
  const isCls = datasetType === "classification";
  const selectMode = selected.size > 0;

  const toggleSelect = (img: ImageItem) => {
    const key = img.imageRel;
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === images.length) setSelected(new Set());
    else setSelected(new Set(images.map(img => img.imageRel)));
  };

  const handleDeleteSelected = async () => {
    if (!selected.size) return;
    if (!window.confirm(`Delete ${selected.size} image(s)? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      if (isCls) {
        await api.classificationDeleteImages([...selected]);
      } else {
        for (const key of selected) {
          const img = images.find(i => i.imageRel === key);
          if (img) await api.deleteImage(img.split, img.name);
        }
      }
      setSelected(new Set());
      loadPage();
    } catch {}
    finally { setDeleting(false); }
  };

  const handleMoveSelected = async () => {
    if (!selected.size || !moveTarget) return;
    if (!window.confirm(`Move ${selected.size} image(s) to class "${moveTarget}"?`)) return;
    setMoving(true);
    try {
      await api.classificationMoveImages([...selected], moveTarget);
      setSelected(new Set());
      setMoveTarget("");
      loadPage();
    } catch {}
    finally { setMoving(false); }
  };

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
            {isCls && <option value="size_asc">File size (smallest first)</option>}
            {isCls && <option value="size_desc">File size (largest first)</option>}
            {!isCls && <option value="area_asc">BBox area (smallest first)</option>}
            {!isCls && <option value="area_desc">BBox area (largest first)</option>}
          </select>
          <button className={`btn ${viewMode === "grid" ? "btn-primary" : "btn-ghost"}`} onClick={() => setViewMode("grid")}>Grid</button>
          <button className={`btn ${viewMode === "list" ? "btn-primary" : "btn-ghost"}`} onClick={() => setViewMode("list")}>List</button>
          {!isCls && <button className={`btn ${viewMode === "gallery" ? "btn-primary" : "btn-ghost"}`} onClick={() => setViewMode("gallery")}>Gallery</button>}
        </div>
      </div>

      {/* Selection toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap", fontSize: "0.9rem" }}>
        <button className="btn btn-ghost" style={{ padding: "0.3rem 0.6rem" }} onClick={selectAll}>
          {selected.size === images.length && images.length > 0 ? "Deselect all" : "Select all"}
        </button>
        {selectMode && (
          <>
            <span style={{ color: "var(--color-text-muted)" }}>{selected.size} selected</span>
            <button className="btn btn-ghost" style={{ padding: "0.3rem 0.6rem", color: "var(--color-danger)" }} onClick={handleDeleteSelected} disabled={deleting}>
              {deleting ? "Deleting…" : `Delete ${selected.size}`}
            </button>
            {isCls && classes.length > 1 && (
              <>
                <select className="input" style={{ width: "auto", padding: "0.25rem 0.4rem", fontSize: "0.85rem" }} value={moveTarget} onChange={e => setMoveTarget(e.target.value)}>
                  <option value="">Move to…</option>
                  {classes.filter(c => c.id !== id).map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
                {moveTarget && (
                  <button className="btn btn-primary" style={{ padding: "0.3rem 0.6rem" }} onClick={handleMoveSelected} disabled={moving}>
                    {moving ? "Moving…" : "Move"}
                  </button>
                )}
              </>
            )}
            <button className="btn btn-ghost" style={{ padding: "0.3rem 0.6rem" }} onClick={() => setSelected(new Set())}>Cancel</button>
          </>
        )}
        {!selectMode && (
          <span style={{ color: "var(--color-text-muted)", fontSize: "0.85rem" }}>Click thumbnails to select for bulk actions</span>
        )}
      </div>

      {viewMode === "gallery" && !isCls ? (
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
            {images.map((img, idx) => {
              const isSelected = selected.has(img.imageRel);
              return (
                <div
                  key={img.imageRel}
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
                    cursor: "pointer",
                    outline: isSelected ? "3px solid var(--color-danger)" : undefined,
                    outlineOffset: isSelected ? "-3px" : undefined,
                    opacity: isSelected ? 0.8 : 1,
                  }}
                  onClick={(e) => {
                    if (selectMode || e.ctrlKey || e.metaKey || e.shiftKey) {
                      e.preventDefault();
                      toggleSelect(img);
                    }
                  }}
                >
                  {/* Selection checkbox */}
                  <span
                    onClick={(e) => { e.stopPropagation(); toggleSelect(img); }}
                    style={{
                      position: "absolute", top: 4, left: 4, zIndex: 2,
                      width: 22, height: 22, borderRadius: 4,
                      background: isSelected ? "var(--color-danger)" : "rgba(0,0,0,0.35)",
                      border: "2px solid #fff",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      color: "#fff", fontSize: "0.8rem", fontWeight: 700, cursor: "pointer",
                    }}
                  >
                    {isSelected ? "✓" : ""}
                  </span>

                  <Link
                    to={`/image/${encodeURIComponent(img.split)}/${encodeURIComponent(img.name)}`}
                    state={{ classId, classSort: sortBy || undefined, startIndex: (page - 1) * PAGE_SIZE + idx }}
                    style={{ textDecoration: "none", color: "inherit", display: "flex", flexDirection: viewMode === "list" ? "row" : "column", alignItems: viewMode === "list" ? "center" : undefined, gap: viewMode === "list" ? "1rem" : 0, flex: 1 }}
                    onClick={(e) => { if (selectMode) e.preventDefault(); }}
                  >
                    <div style={{ aspectRatio: "1", minWidth: viewMode === "list" ? 80 : undefined, background: "var(--color-border)", borderRadius: "var(--radius-sm)", overflow: "hidden" }}>
                      <img
                        src={imageSrc(img, datasetType)}
                        alt=""
                        style={{ width: "100%", height: "100%", objectFit: "contain" }}
                        loading="lazy"
                      />
                    </div>
                    {img.bboxArea != null && !isCls && (
                      <span style={{
                        position: "absolute", bottom: viewMode === "list" ? "auto" : 4, right: 4, top: viewMode === "list" ? 4 : "auto",
                        background: img.bboxArea < 0.001 ? "rgba(239,68,68,0.85)" : img.bboxArea < 0.005 ? "rgba(234,179,8,0.85)" : "rgba(0,0,0,0.55)",
                        color: "#fff", fontSize: "0.65rem", padding: "1px 4px", borderRadius: 3, fontVariantNumeric: "tabular-nums",
                      }}>
                        {(img.bboxArea * 100).toFixed(2)}%
                      </span>
                    )}
                    {img.fileSize != null && (
                      <span style={{
                        position: "absolute", bottom: viewMode === "list" ? "auto" : 4, right: 4, top: viewMode === "list" ? 4 : "auto",
                        background: "rgba(0,0,0,0.55)", color: "#fff", fontSize: "0.65rem", padding: "1px 4px", borderRadius: 3, fontVariantNumeric: "tabular-nums",
                      }}>
                        {formatFileSize(img.fileSize)}
                      </span>
                    )}
                    {viewMode === "list" && (
                      <span style={{ fontSize: "0.9rem", color: "var(--color-text-muted)" }}>
                        {img.name}
                        {img.fileSize != null && <span style={{ marginLeft: "0.5rem", fontSize: "0.8rem" }}>{formatFileSize(img.fileSize)}</span>}
                        {img.bboxArea != null && !isCls && <span style={{ marginLeft: "0.5rem", fontSize: "0.8rem", color: img.bboxArea < 0.001 ? "var(--color-danger)" : "var(--color-text-muted)" }}>area: {(img.bboxArea * 100).toFixed(3)}%</span>}
                      </span>
                    )}
                  </Link>
                </div>
              );
            })}
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

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
