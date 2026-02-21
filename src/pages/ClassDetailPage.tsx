import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "@/api";
import { ClassGalleryView } from "@/components/ClassGalleryView";
import type { ClassItem, ImageItem } from "@/types";

const PAGE_SIZE = 24;

export default function ClassDetailPage() {
  const { classId } = useParams<{ classId: string }>();
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [page, setPage] = useState(0);
  const [accumulatedImages, setAccumulatedImages] = useState<ImageItem[]>([]);
  const [total, setTotal] = useState(0);
  const [nextPageToLoad, setNextPageToLoad] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list" | "gallery">("grid");

  const id = classId ? parseInt(classId, 10) : NaN;

  useEffect(() => {
    api.getSummary().then((s) => setClasses(s.classes ?? [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!classId || isNaN(id)) return;
    setLoading(true);
    setAccumulatedImages([]);
    setNextPageToLoad(1);
    api
      .getClassImages(id, 1, PAGE_SIZE)
      .then((r) => {
        setAccumulatedImages(r.images);
        setTotal(r.total);
        setNextPageToLoad(2);
      })
      .finally(() => setLoading(false));
  }, [classId, id]);

  const loadMore = () => {
    if (loadingMore || nextPageToLoad <= 0 || accumulatedImages.length >= total) return;
    setLoadingMore(true);
    api
      .getClassImages(id, nextPageToLoad, PAGE_SIZE)
      .then((r) => {
        setAccumulatedImages((prev) => [...prev, ...r.images]);
        setNextPageToLoad((p) => p + 1);
      })
      .finally(() => setLoadingMore(false));
  };

  const hasMore = accumulatedImages.length < total && total > 0;
  const totalPages = Math.max(1, Math.ceil(accumulatedImages.length / PAGE_SIZE));
  const gridImages = viewMode === "gallery" ? accumulatedImages : accumulatedImages.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const cls = classes.find((c) => c.id === id);

  if (!classId) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {/* Class-centric breadcrumb: Classes > Class name */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.75rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
          <Link to="/" className="btn btn-ghost" style={{ padding: "0.35rem 0.5rem" }}>
            ← Classes
          </Link>
          <span style={{ color: "var(--color-text-muted)", fontSize: "0.9rem" }}>/</span>
          <h1 style={{ fontSize: "1.35rem", fontWeight: 600 }}>{cls?.name ?? `Class ${classId}`}</h1>
          <span style={{ color: "var(--color-text-muted)", fontSize: "0.9rem" }}>{total} images</span>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button
            className={`btn ${viewMode === "grid" ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setViewMode("grid")}
          >
            Grid
          </button>
          <button
            className={`btn ${viewMode === "list" ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setViewMode("list")}
          >
            List
          </button>
          <button
            className={`btn ${viewMode === "gallery" ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setViewMode("gallery")}
          >
            Gallery
          </button>
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
              gridTemplateColumns: viewMode === "grid" ? "repeat(auto-fill, minmax(140px, 1fr))" : "1fr",
              gap: "0.5rem",
            }}
          >
            {gridImages.map((img, idx) => (
              <Link
                key={img.imageRel}
                to={`/image/${encodeURIComponent(img.split)}/${encodeURIComponent(img.name)}`}
                state={{ list: accumulatedImages, index: page * PAGE_SIZE + idx, classId }}
                className="card"
                style={{
                  padding: viewMode === "list" ? "0.5rem 0.75rem" : 0,
                  display: "flex",
                  flexDirection: viewMode === "list" ? "row" : "column",
                  alignItems: viewMode === "list" ? "center" : undefined,
                  gap: viewMode === "list" ? "1rem" : 0,
                  textDecoration: "none",
                  color: "inherit",
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
                {viewMode === "list" && (
                  <span style={{ fontSize: "0.9rem", color: "var(--color-text-muted)" }}>{img.name}</span>
                )}
              </Link>
            ))}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
            {totalPages > 1 && (
              <>
                <button
                  className="btn btn-ghost"
                  disabled={page === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                >
                  Previous
                </button>
                <span style={{ fontSize: "0.9rem", color: "var(--color-text-muted)" }}>
                  Page {page + 1} of {totalPages} · {accumulatedImages.length} loaded
                </span>
                <button
                  className="btn btn-ghost"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                >
                  Next
                </button>
              </>
            )}
            {hasMore && (
              <button className="btn btn-primary" onClick={loadMore} disabled={loadingMore} style={{ marginLeft: "auto" }}>
                {loadingMore ? "Loading…" : `Load more (${accumulatedImages.length} / ${total})`}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
