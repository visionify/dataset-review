import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { api, imageBase } from "@/api";
import { BBoxCanvas } from "@/components/BBoxCanvas";
import type { BBox, ClassItem, ImageItem } from "@/types";

const GALLERY_PAGE_SIZE = 4;

export function ClassGalleryView({
  classId,
  classIdNum,
  classes,
  totalImages,
}: {
  classId: string;
  classIdNum: number;
  className?: string;
  classes: ClassItem[];
  totalImages: number;
}) {
  const [galleryPage, setGalleryPage] = useState(0);
  const [images, setImages] = useState<ImageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const totalGalleryPages = Math.max(1, Math.ceil(totalImages / GALLERY_PAGE_SIZE));

  useEffect(() => {
    setLoading(true);
    api
      .getClassImages(classIdNum, galleryPage + 1, GALLERY_PAGE_SIZE)
      .then((r) => setImages(r.images))
      .finally(() => setLoading(false));
  }, [classIdNum, galleryPage]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
        <span style={{ fontSize: "0.9rem", color: "var(--color-text-muted)" }}>
          Gallery: 4 images · Page {galleryPage + 1} of {totalGalleryPages}
        </span>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button
            className="btn btn-ghost"
            disabled={galleryPage === 0}
            onClick={() => setGalleryPage((p) => Math.max(0, p - 1))}
          >
            ← Prev 4
          </button>
          <button
            className="btn btn-ghost"
            disabled={galleryPage >= totalGalleryPages - 1}
            onClick={() => setGalleryPage((p) => Math.min(totalGalleryPages - 1, p + 1))}
          >
            Next 4 →
          </button>
        </div>
      </div>
      {loading ? (
        <p style={{ color: "var(--color-text-muted)" }}>Loading…</p>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "1rem",
            minHeight: "60vh",
          }}
        >
          {images.map((img, idx) => (
            <GalleryCell
              key={img.imageRel}
              image={img}
              classId={classId}
              classIdNum={classIdNum}
              classes={classes}
              list={images}
              index={idx}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function GalleryCell({
  image,
  classId,
  classIdNum,
  classes,
  list,
  index,
}: {
  image: ImageItem;
  classId: string;
  classIdNum: number;
  classes: ClassItem[];
  list: ImageItem[];
  index: number;
}) {
  const [boxes, setBoxes] = useState<BBox[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const base = imageBase(image.name);
  const classNames = Object.fromEntries(classes.map((c) => [c.id, c.name]));

  useEffect(() => {
    api.getAnnotations(image.split, base).then(setBoxes).catch(() => setBoxes([]));
  }, [image.split, base]);

  const save = useCallback(async () => {
    setSaving(true);
    setMsg(null);
    try {
      await api.saveAnnotations(image.split, base, boxes);
      setMsg("Saved");
      setTimeout(() => setMsg(null), 1500);
    } catch {
      setMsg("Error");
    } finally {
      setSaving(false);
    }
  }, [image.split, base, boxes]);

  return (
    <div className="card" style={{ padding: "0.5rem", display: "flex", flexDirection: "column", gap: "0.5rem", minHeight: "280px" }}>
      <div style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "center", minHeight: "200px", background: "var(--color-border)", borderRadius: "var(--radius-sm)", overflow: "hidden" }}>
        <BBoxCanvas
          imageUrl={api.imageUrl(image.split, image.name)}
          boxes={boxes}
          classNames={classNames}
          selectedIndex={selectedIndex}
          defaultClassId={classIdNum}
          focusedClassId={classIdNum}
          onSelect={setSelectedIndex}
          onBoxesChange={setBoxes}
          maxHeight="240px"
        />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
        <Link
          to={`/image/${encodeURIComponent(image.split)}/${encodeURIComponent(image.name)}`}
          state={{ list, index, classId }}
          style={{ fontSize: "0.8rem", color: "var(--color-accent)", textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "180px" }}
          title={image.name}
        >
          {image.name}
        </Link>
        <button className="btn btn-primary" style={{ padding: "0.25rem 0.5rem", fontSize: "0.8rem" }} onClick={save} disabled={saving}>
          {saving ? "…" : "Save"}
        </button>
        {msg && <span style={{ fontSize: "0.75rem", color: "var(--color-success)" }}>{msg}</span>}
      </div>
    </div>
  );
}
