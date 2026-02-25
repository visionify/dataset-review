import { useEffect, useState, useCallback } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { api, imageBase } from "@/api";
import type { ImageItem } from "@/types";

const PAGE_SIZE = 48;

export default function ImagesPage() {
  const { split } = useParams<{ split: string }>();
  const [searchParams] = useSearchParams();
  const tagType = searchParams.get("tagType") || "";
  const tagValue = searchParams.get("tag") || "";
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof api.getSummary>> | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [images, setImages] = useState<ImageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterReviewed, setFilterReviewed] = useState<"all" | "no">("all");
  const [reviewedSet, setReviewedSet] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [allImages, setAllImages] = useState<ImageItem[]>([]);
  const [loadingAll, setLoadingAll] = useState(false);

  const effectiveSplit = split === "all" || !split ? "all" : split;
  const selectMode = selected.size > 0;

  useEffect(() => {
    api.getSummary().then(setSummary).catch(() => setSummary(null));
    api.getReviewed().then(r => setReviewedSet(new Set(r.reviewed))).catch(() => {});
  }, []);

  const loadPage = useCallback(() => {
    if (!summary?.configured) { setLoading(false); return; }
    setLoading(true);
    api.getImages({ split: effectiveSplit, page: page + 1, limit: PAGE_SIZE, reviewed: filterReviewed === "no" ? "no" : undefined, tagType: tagType || undefined, tag: tagValue || undefined })
      .then(r => { setImages(r.images); setTotal(r.total); })
      .finally(() => setLoading(false));
  }, [summary?.configured, effectiveSplit, page, filterReviewed, tagType, tagValue]);

  useEffect(() => { loadPage(); }, [loadPage]);

  // Clear selection and show-all when changing split/filter/tag
  useEffect(() => { setSelected(new Set()); setShowAll(false); setAllImages([]); setPage(0); }, [effectiveSplit, filterReviewed, tagType, tagValue]);
  useEffect(() => { if (!showAll) setSelected(new Set()); }, [page]);

  const toggleSelect = (img: ImageItem) => {
    const key = `${img.split}/${img.name}`;
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const displayImages = showAll ? allImages : images;

  const selectAll = () => {
    if (selected.size === displayImages.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(displayImages.map(img => `${img.split}/${img.name}`)));
    }
  };

  const handleShowAll = useCallback(async () => {
    setLoadingAll(true);
    try {
      const accumulated: ImageItem[] = [];
      let pg = 1;
      let hasMore = true;
      while (hasMore) {
        const r = await api.getImages({ split: effectiveSplit, page: pg, limit: 5000, reviewed: filterReviewed === "no" ? "no" : undefined, tagType: tagType || undefined, tag: tagValue || undefined });
        accumulated.push(...r.images);
        hasMore = r.images.length === 5000;
        pg++;
      }
      setAllImages(accumulated);
      setTotal(accumulated.length);
      setShowAll(true);
    } catch {}
    finally { setLoadingAll(false); }
  }, [effectiveSplit, filterReviewed, tagType, tagValue]);

  const handleDeleteSelected = async () => {
    if (!selected.size) return;
    if (!window.confirm(`Delete ${selected.size} image(s) and their labels? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      for (const key of selected) {
        const slashIdx = key.indexOf("/");
        const s = key.slice(0, slashIdx);
        const name = key.slice(slashIdx + 1);
        await api.deleteImage(s, name);
      }
      setSelected(new Set());
      if (showAll) {
        setAllImages(prev => {
          const remaining = prev.filter(img => !selected.has(`${img.split}/${img.name}`));
          setTotal(remaining.length);
          return remaining;
        });
      } else {
        loadPage();
      }
      api.getSummary().then(setSummary).catch(() => {});
      api.getReviewed().then(r => setReviewedSet(new Set(r.reviewed))).catch(() => {});
    } catch {}
    finally { setDeleting(false); }
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const reviewedCount = summary?.reviewedCount ?? 0;
  const totalImages = summary?.totalImages ?? 0;
  const pctReviewed = totalImages ? Math.round((reviewedCount / totalImages) * 100) : 0;

  if (!summary?.configured) {
    return (
      <div>
        <Link to="/" className="btn btn-ghost">← Dashboard</Link>
        <p style={{ marginTop: "1rem" }}>No dataset configured. Set path in Dataset.</p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.75rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
          <Link to="/" className="btn btn-ghost" style={{ padding: "0.35rem 0.5rem" }}>← Dashboard</Link>
          <h1 style={{ fontSize: "1.35rem" }}>
            {effectiveSplit === "all" ? "All Images" : effectiveSplit === "train" ? "Training" : effectiveSplit === "val" ? "Validation" : "Test"}
          </h1>
          {tagValue && (
            <span style={{ fontSize: "0.85rem", padding: "0.2rem 0.5rem", borderRadius: "var(--radius-sm)", background: "oklch(0.65 0.12 250 / 0.15)", border: "1px solid oklch(0.65 0.12 250 / 0.3)" }}>
              {tagType}: <strong>{tagValue}</strong>
              <Link to={`/images/${effectiveSplit}`} style={{ marginLeft: "0.4rem", color: "var(--color-text-muted)", textDecoration: "none" }}>×</Link>
            </span>
          )}
          <span style={{ color: "var(--color-text-muted)", fontSize: "0.9rem" }}>
            {total} images
            <span style={{ marginLeft: "0.5rem" }}>· <strong style={{ color: "var(--color-text)" }}>{pctReviewed}%</strong> reviewed ({reviewedCount} / {totalImages})</span>
          </span>
          <label style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.9rem" }}>
            <input type="checkbox" checked={filterReviewed === "no"} onChange={e => { setFilterReviewed(e.target.checked ? "no" : "all"); setPage(0); }} />
            Not reviewed only
          </label>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          {showAll ? (
            <button className="btn btn-ghost" onClick={() => { setShowAll(false); setSelected(new Set()); }}>Paginated view</button>
          ) : (
            <>
              <button className="btn btn-ghost" disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))}>Previous</button>
              <span style={{ fontSize: "0.9rem", color: "var(--color-text-muted)" }}>Page {page + 1} of {totalPages}</span>
              <button className="btn btn-ghost" disabled={page >= totalPages - 1} onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}>Next</button>
              <button className="btn btn-primary" style={{ padding: "0.3rem 0.6rem", marginLeft: "0.25rem" }} onClick={handleShowAll} disabled={loadingAll}>
                {loadingAll ? "Loading all…" : "Show all"}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Selection toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap", fontSize: "0.9rem" }}>
        <button className="btn btn-ghost" style={{ padding: "0.3rem 0.6rem" }} onClick={selectAll}>
          {selected.size === displayImages.length && displayImages.length > 0 ? "Deselect all" : "Select all"}
        </button>
        {selectMode && (
          <>
            <span style={{ color: "var(--color-text-muted)" }}>{selected.size} selected</span>
            <button className="btn btn-ghost" style={{ padding: "0.3rem 0.6rem", color: "var(--color-danger)" }} onClick={handleDeleteSelected} disabled={deleting}>
              {deleting ? "Deleting…" : `Delete ${selected.size} image${selected.size > 1 ? "s" : ""}`}
            </button>
            <button className="btn btn-ghost" style={{ padding: "0.3rem 0.6rem" }} onClick={() => setSelected(new Set())}>Cancel</button>
          </>
        )}
        {!selectMode && (
          <span style={{ color: "var(--color-text-muted)", fontSize: "0.85rem" }}>Click thumbnails to select for bulk delete</span>
        )}
      </div>

      {(loading || loadingAll) ? (
        <p style={{ color: "var(--color-text-muted)" }}>{loadingAll ? `Loading all images…` : "Loading…"}</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "0.6rem" }}>
          {displayImages.map((img, idx) => {
            const reviewKey = `${img.split}/${imageBase(img.name)}`;
            const selectKey = `${img.split}/${img.name}`;
            const isReviewed = reviewedSet.has(reviewKey);
            const isSelected = selected.has(selectKey);
            const globalIdx = showAll ? idx : page * PAGE_SIZE + idx;
            return (
              <div
                key={`${img.split}/${img.name}`}
                className="card"
                style={{
                  padding: 0, overflow: "hidden", position: "relative", cursor: "pointer",
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
                  title="Select for deletion"
                >
                  {isSelected ? "✓" : ""}
                </span>

                <Link
                  to={`/image/${encodeURIComponent(img.split)}/${encodeURIComponent(img.name)}`}
                  state={{ fromSplit: effectiveSplit, filterReviewed: filterReviewed === "no" ? "no" : undefined, startIndex: globalIdx, tagType: tagType || undefined, tag: tagValue || undefined }}
                  style={{ textDecoration: "none", color: "inherit" }}
                  onClick={(e) => { if (selectMode) e.preventDefault(); }}
                >
                  <div style={{ aspectRatio: "1", background: "var(--color-border)" }}>
                    <img src={api.imageUrl(img.split, img.name)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} loading="lazy" />
                  </div>
                  <div style={{ padding: "0.3rem 0.4rem", fontSize: "0.75rem", color: "var(--color-text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{img.name}</div>
                </Link>

                {isReviewed && (
                  <span style={{ position: "absolute", top: 4, right: 4, background: "rgba(34,197,94,0.85)", color: "#fff", borderRadius: "50%", width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.8rem", fontWeight: 700, lineHeight: 1 }} title="Reviewed">✓</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
