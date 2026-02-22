import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, imageBase } from "@/api";
import type { ImageItem } from "@/types";

const PAGE_SIZE = 48;

export default function ImagesPage() {
  const { split } = useParams<{ split: string }>();
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof api.getSummary>> | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [images, setImages] = useState<ImageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterReviewed, setFilterReviewed] = useState<"all" | "no">("all");
  const [reviewedSet, setReviewedSet] = useState<Set<string>>(new Set());

  const effectiveSplit = split === "all" || !split ? "all" : split;

  useEffect(() => {
    api.getSummary().then(setSummary).catch(() => setSummary(null));
    api.getReviewed().then(r => setReviewedSet(new Set(r.reviewed))).catch(() => {});
  }, []);

  useEffect(() => {
    if (!summary?.configured) { setLoading(false); return; }
    setLoading(true);
    api.getImages({ split: effectiveSplit, page: page + 1, limit: PAGE_SIZE, reviewed: filterReviewed === "no" ? "no" : undefined })
      .then(r => { setImages(r.images); setTotal(r.total); })
      .finally(() => setLoading(false));
  }, [summary?.configured, effectiveSplit, page, filterReviewed]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const reviewedCount = summary?.reviewedCount ?? 0;
  const totalImages = summary?.totalImages ?? 0;
  const pctReviewed = totalImages ? Math.round((reviewedCount / totalImages) * 100) : 0;

  if (!summary?.configured) {
    return (
      <div>
        <Link to="/" className="btn btn-ghost">← Classes</Link>
        <p style={{ marginTop: "1rem" }}>No dataset configured. Set path in Dataset.</p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.75rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
          <Link to="/" className="btn btn-ghost" style={{ padding: "0.35rem 0.5rem" }}>← Classes</Link>
          <h1 style={{ fontSize: "1.35rem" }}>
            {effectiveSplit === "all" ? "All Images" : effectiveSplit === "train" ? "Training" : effectiveSplit === "val" ? "Validation" : "Test"}
          </h1>
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
          <button className="btn btn-ghost" disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))}>Previous</button>
          <span style={{ fontSize: "0.9rem", color: "var(--color-text-muted)" }}>Page {page + 1} of {totalPages}</span>
          <button className="btn btn-ghost" disabled={page >= totalPages - 1} onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}>Next</button>
        </div>
      </div>
      {loading ? (
        <p style={{ color: "var(--color-text-muted)" }}>Loading…</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "0.6rem" }}>
          {images.map((img, idx) => {
            const key = `${img.split}/${imageBase(img.name)}`;
            const isReviewed = reviewedSet.has(key);
            return (
              <Link
                key={img.imageRel}
                to={`/image/${encodeURIComponent(img.split)}/${encodeURIComponent(img.name)}`}
                state={{ fromSplit: effectiveSplit, filterReviewed: filterReviewed === "no" ? "no" : undefined, startIndex: page * PAGE_SIZE + idx }}
                className="card"
                style={{ padding: 0, overflow: "hidden", textDecoration: "none", color: "inherit", position: "relative" }}
              >
                <div style={{ aspectRatio: "1", background: "var(--color-border)" }}>
                  <img src={api.imageUrl(img.split, img.name)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} loading="lazy" />
                </div>
                {isReviewed && (
                  <span style={{ position: "absolute", top: 4, right: 4, background: "rgba(34,197,94,0.85)", color: "#fff", borderRadius: "50%", width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.8rem", fontWeight: 700, lineHeight: 1 }} title="Reviewed">✓</span>
                )}
                <div style={{ padding: "0.3rem 0.4rem", fontSize: "0.75rem", color: "var(--color-text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{img.name}</div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
