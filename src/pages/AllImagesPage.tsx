import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/api";
import type { ImageItem } from "@/types";

const PAGE_SIZE = 48;

export default function AllImagesPage() {
  const [configured, setConfigured] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [images, setImages] = useState<ImageItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getSummary().then((s) => setConfigured(s.configured)).catch(() => setConfigured(false));
  }, []);

  useEffect(() => {
    if (!configured) {
      setLoading(false);
      return;
    }
    setLoading(true);
    api
      .getImages({ page: page + 1, limit: PAGE_SIZE })
      .then((r) => {
        setImages(r.images);
        setTotal(r.total);
      })
      .finally(() => setLoading(false));
  }, [configured, page]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  if (!configured) {
    return (
      <div>
        <Link to="/" className="btn btn-ghost">← Classes</Link>
        <p style={{ marginTop: "1rem" }}>No dataset configured.</p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.75rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <Link to="/" className="btn btn-ghost" style={{ padding: "0.35rem 0.5rem" }}>← Classes</Link>
          <h1 style={{ fontSize: "1.35rem" }}>All images</h1>
          <span style={{ color: "var(--color-text-muted)", fontSize: "0.9rem" }}>{total} images</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <button className="btn btn-ghost" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>Previous</button>
          <span style={{ fontSize: "0.9rem", color: "var(--color-text-muted)" }}>Page {page + 1} of {totalPages}</span>
          <button className="btn btn-ghost" disabled={page >= totalPages - 1} onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}>Next</button>
        </div>
      </div>
      {loading ? (
        <p style={{ color: "var(--color-text-muted)" }}>Loading…</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: "0.5rem" }}>
          {images.map((img, idx) => (
            <Link
              key={img.imageRel}
              to={`/image/${encodeURIComponent(img.split)}/${encodeURIComponent(img.name)}`}
              state={{ list: images, index: idx }}
              className="card"
              style={{ padding: 0, overflow: "hidden", textDecoration: "none", color: "inherit" }}
            >
              <div style={{ aspectRatio: "1", background: "var(--color-border)" }}>
                <img src={api.imageUrl(img.split, img.name)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} loading="lazy" />
              </div>
              <div style={{ padding: "0.25rem 0.4rem", fontSize: "0.75rem", color: "var(--color-text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{img.name}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
