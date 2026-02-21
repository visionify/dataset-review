import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/api";
import type { ClassItem, ImageItem } from "@/types";

export default function ClassesPage() {
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof api.getSummary>> | null>(null);
  const [samplesByClass, setSamplesByClass] = useState<Record<number, ImageItem[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    api
      .getSummary()
      .then((data) => {
        setSummary(data);
        if (data.configured && data.classes?.length) {
          return Promise.all(
            data.classes.map((cls) =>
              api.getClassSamples(cls.id, 8).then((r) => [cls.id, r.samples] as const)
            )
          ).then((pairs) => {
            setSamplesByClass(Object.fromEntries(pairs));
          });
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p style={{ color: "var(--color-text-muted)" }}>Loading dataset…</p>;
  if (error) return <p style={{ color: "var(--color-danger)" }}>{error}</p>;
  if (!summary?.configured) {
    return (
      <div className="card" style={{ padding: "1.5rem", maxWidth: "28rem" }}>
        <p style={{ marginBottom: "1rem" }}>No dataset set. Open Dataset to choose a folder.</p>
        <Link to="/config" className="btn btn-primary">
          Open Dataset
        </Link>
      </div>
    );
  }

  const classes = summary.classes ?? [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
        <h1 style={{ fontSize: "1.5rem" }}>Classes</h1>
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
          <span style={{ color: "var(--color-text-muted)", fontSize: "0.9rem" }}>
            {classes.length} classes · {summary.totalImages} images
          </span>
          <Link to="/validation" className="btn btn-ghost">
            Validation
          </Link>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: "1rem",
        }}
      >
        {classes.map((cls) => (
          <ClassCard
            key={cls.id}
            cls={cls}
            samples={samplesByClass[cls.id] ?? []}
          />
        ))}
      </div>
    </div>
  );
}

function ClassCard({ cls, samples }: { cls: ClassItem; samples: ImageItem[] }) {
  return (
    <div className="card" style={{ padding: "1rem", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
        <h2 style={{ fontSize: "1rem", fontWeight: 600 }}>{cls.name}</h2>
        <span style={{ fontSize: "0.8rem", color: "var(--color-text-muted)" }}>id {cls.id}</span>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "4px",
          borderRadius: "var(--radius-sm)",
          overflow: "hidden",
        }}
      >
        {samples.slice(0, 8).map((img, idx) => (
          <Link
            key={img.imageRel}
            to={`/image/${encodeURIComponent(img.split)}/${encodeURIComponent(img.name)}`}
            state={{ list: samples, index: idx, classId: String(cls.id) }}
            style={{ aspectRatio: "1", display: "block", background: "var(--color-border)" }}
          >
            <img
              src={api.imageUrl(img.split, img.name)}
              alt=""
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
              loading="lazy"
            />
          </Link>
        ))}
      </div>
      <div style={{ marginTop: "0.75rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        <Link
          to={`/class/${cls.id}`}
          className="btn btn-ghost"
          style={{ fontSize: "0.85rem", padding: "0.35rem 0.6rem" }}
        >
          View all
        </Link>
      </div>
    </div>
  );
}
