import { useEffect, useState, useCallback } from "react";
import { Link, useParams, useLocation, useNavigate } from "react-router-dom";
import { api, imageBase } from "@/api";
import { BBoxCanvas } from "@/components/BBoxCanvas";
import type { BBox, ImageItem, ClassItem } from "@/types";

const DEFAULT_CLASS_KEY = "pallet-review-default-class";

export default function ImageDetailPage() {
  const { split, name } = useParams<{ split: string; name: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as { list?: ImageItem[]; index?: number; classId?: string; fromSplit?: string } | null;

  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [classColors, setClassColors] = useState<Record<number, string>>({});
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof api.getSummary>> | null>(null);
  const [boxes, setBoxes] = useState<BBox[]>([]);
  const [tagList, setTagList] = useState<[string, string][]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [defaultClassId, setDefaultClassIdState] = useState(0);
  const [showTags, setShowTags] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const setDefaultClassId = useCallback((id: number) => {
    setDefaultClassIdState(id);
    try {
      localStorage.setItem(DEFAULT_CLASS_KEY, String(id));
    } catch (_) {}
  }, []);

  const list = state?.list ?? [];
  const currentIndex = state?.index ?? (split && name ? list.findIndex((i) => i.split === split && i.name === name) : 0);
  const currentImage = list[currentIndex] ?? (split && name ? { split: split!, name: name!, imageRel: `images/${split}/${name}`, relPath: "" } : null);

  const base = currentImage ? imageBase(currentImage.name) : "";
  const prevImage = currentIndex > 0 ? list[currentIndex - 1] : null;
  const nextImage = currentIndex >= 0 && currentIndex < list.length - 1 ? list[currentIndex + 1] : null;

  useEffect(() => {
    try {
      const stored = localStorage.getItem(DEFAULT_CLASS_KEY);
      if (stored != null) {
        const n = parseInt(stored, 10);
        if (!isNaN(n)) setDefaultClassIdState(n);
      }
    } catch (_) {}
  }, []);

  const loadSummary = useCallback(() => {
    api.getSummary().then((s) => {
      setClasses(s.classes ?? []);
      setSummary(s);
    }).catch(() => {});
    api.getClassColors().then((c) => setClassColors(c || {})).catch(() => setClassColors({}));
  }, []);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    if (!split || !name) return;
    const baseName = imageBase(name);
    Promise.all([
      api.getAnnotations(split, baseName),
      api.getTags(split, baseName),
    ]).then(([ann, t]) => {
      setBoxes(ann);
      const tagObj = (t && typeof t === "object" && !Array.isArray(t)) ? t as Record<string, unknown> : {};
      setTagList(Object.entries(tagObj).map(([k, v]) => [k, String(v ?? "")]));
    }).catch(() => {
      setBoxes([]);
      setTagList([]);
    });
  }, [split, name]);

  const saveAnnotations = useCallback(async () => {
    if (!split || !base) return;
    setSaving(true);
    setMessage(null);
    try {
      await api.saveAnnotations(split, base, boxes);
      setMessage("Annotations saved.");
      setTimeout(() => setMessage(null), 2000);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }, [split, base, boxes]);

  const saveTags = useCallback(async () => {
    if (!split || !base) return;
    const obj = Object.fromEntries(tagList.filter(([k]) => k.trim() !== ""));
    setSaving(true);
    setMessage(null);
    try {
      await api.saveTags(split, base, obj);
      setMessage("Tags saved.");
      setTimeout(() => setMessage(null), 2000);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }, [split, base, tagList]);

  const goNext = useCallback(() => {
    if (!nextImage || !split || !base) return;
    api.setReviewed(split, base, true).catch(() => {});
    navigate(`/image/${encodeURIComponent(nextImage.split)}/${encodeURIComponent(nextImage.name)}`, {
      state: { list, index: currentIndex + 1, classId: state?.classId, fromSplit: state?.fromSplit },
    });
  }, [nextImage, split, base, list, currentIndex, state?.classId, state?.fromSplit, navigate]);

  const goPrev = useCallback(() => {
    if (!prevImage) return;
    navigate(`/image/${encodeURIComponent(prevImage.split)}/${encodeURIComponent(prevImage.name)}`, {
      state: { list, index: currentIndex - 1, classId: state?.classId, fromSplit: state?.fromSplit },
    });
  }, [prevImage, list, currentIndex, state?.classId, state?.fromSplit, navigate]);

  const handleDeleteImage = useCallback(async () => {
    if (!currentImage || !window.confirm("Delete this image and its label file from the dataset? This cannot be undone.")) return;
    setDeleting(true);
    try {
      await api.deleteImage(currentImage.split, currentImage.name);
      const fromSplit = state?.fromSplit ?? "all";
      const newList = list.filter((_, i) => i !== currentIndex);
      const nextIdx = currentIndex < newList.length ? currentIndex : Math.max(0, currentIndex - 1);
      const next = newList[nextIdx];
      if (next) {
        navigate(`/image/${encodeURIComponent(next.split)}/${encodeURIComponent(next.name)}`, {
          state: { list: newList, index: nextIdx, classId: state?.classId, fromSplit },
        });
      } else {
        navigate(`/images/${fromSplit}`, { replace: true });
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  }, [currentImage, list, currentIndex, state?.classId, state?.fromSplit, navigate]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedIndex !== null) {
          e.preventDefault();
          setBoxes((prev) => prev.filter((_, i) => i !== selectedIndex));
          setSelectedIndex(null);
        }
        return;
      }
      if (e.ctrlKey && e.key === "s") {
        e.preventDefault();
        saveAnnotations();
        return;
      }
      if (e.ctrlKey && e.shiftKey && e.key === "S") {
        e.preventDefault();
        saveTags();
        return;
      }
      if (e.key === "t" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const target = e.target as HTMLElement;
        if (target.tagName !== "INPUT" && target.tagName !== "TEXTAREA") {
          setShowTags((s) => !s);
        }
        return;
      }
      const num = parseInt(e.key, 10);
      if (e.key >= "1" && e.key <= "9" && num >= 1 && num <= 9 && selectedIndex !== null && classes.length >= num) {
        e.preventDefault();
        setBoxes((prev) => prev.map((b, i) => (i === selectedIndex ? { ...b, classId: num - 1 } : b)));
      }
      if (e.key === "0" && selectedIndex !== null && classes.length > 0) {
        e.preventDefault();
        setBoxes((prev) => prev.map((b, i) => (i === selectedIndex ? { ...b, classId: 0 } : b)));
      }
      if (e.key === "ArrowLeft" && prevImage) {
        e.preventDefault();
        goPrev();
      }
      if (e.key === "ArrowRight" && nextImage) {
        e.preventDefault();
        goNext();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedIndex, saveAnnotations, saveTags, classes.length, prevImage, nextImage, goPrev, goNext]);

  const addTag = () => setTagList((prev) => [...prev, ["", ""]]);
  const updateTag = (i: number, k: 0 | 1, v: string) =>
    setTagList((prev) => prev.map((row, j) => (j === i ? (k === 0 ? [v, row[1]] : [row[0], v]) : row)));
  const removeTag = (i: number) => setTagList((prev) => prev.filter((_, j) => j !== i));

  if (!currentImage) {
    return (
      <div>
        <Link to="/" className="btn btn-ghost">← Back</Link>
        <p style={{ marginTop: "1rem" }}>Image not found.</p>
      </div>
    );
  }

  const classNames = Object.fromEntries(classes.map((c) => [c.id, c.name]));
  const totalImages = summary?.totalImages ?? 0;
  const reviewedCount = summary?.reviewedCount ?? 0;
  const pctReviewed = totalImages ? Math.round((reviewedCount / totalImages) * 100) : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: "80vh" }}>
      {/* Top bar: nav, % reviewed, prev/next, class, save, delete */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: "0.75rem",
          padding: "0.5rem 0.75rem",
          borderBottom: "1px solid var(--color-border)",
          background: "var(--color-surface)",
          fontSize: "0.85rem",
        }}
      >
        <Link to="/" className="btn btn-ghost" style={{ padding: "0.35rem 0.5rem" }}>← Classes</Link>
        {state?.classId != null && (
          <Link to={`/class/${state.classId}`} className="btn btn-ghost" style={{ padding: "0.35rem 0.5rem" }}>Class</Link>
        )}
        {summary && (
          <span style={{ color: "var(--color-text-muted)", fontWeight: 500 }}>
            {pctReviewed}% reviewed
          </span>
        )}
        {prevImage && (
          <Link
            to={`/image/${encodeURIComponent(prevImage.split)}/${encodeURIComponent(prevImage.name)}`}
            state={{ list, index: currentIndex - 1, classId: state?.classId, fromSplit: state?.fromSplit }}
            className="btn btn-ghost"
            style={{ padding: "0.35rem 0.5rem" }}
          >
            ← Prev
          </Link>
        )}
        <span style={{ color: "var(--color-text-muted)" }}>{currentIndex + 1} / {list.length || 1}</span>
        {nextImage && (
          <Link
            to={`/image/${encodeURIComponent(nextImage.split)}/${encodeURIComponent(nextImage.name)}`}
            state={{ list, index: currentIndex + 1, classId: state?.classId, fromSplit: state?.fromSplit }}
            className="btn btn-ghost"
            style={{ padding: "0.35rem 0.5rem" }}
            onClick={(e) => { e.preventDefault(); goNext(); }}
          >
            Next →
          </Link>
        )}
        <select
          className="input"
          style={{ width: "auto", padding: "0.35rem 0.5rem", maxWidth: "120px" }}
          value={defaultClassId}
          onChange={(e) => setDefaultClassId(parseInt(e.target.value, 10))}
          title="Class for new boxes (persists)"
        >
          {classes.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <span style={{ fontSize: "0.8rem", color: "var(--color-text-muted)" }}>new box</span>
        <button className="btn btn-primary" onClick={saveAnnotations} disabled={saving} style={{ padding: "0.35rem 0.6rem" }}>
          {saving ? "…" : "Save"}
        </button>
        <button className="btn btn-ghost" onClick={() => setShowTags((s) => !s)} style={{ padding: "0.35rem 0.6rem" }}>
          Tags {showTags ? "▼" : "▶"}
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          style={{ padding: "0.35rem 0.6rem", color: "var(--color-danger)" }}
          onClick={handleDeleteImage}
          disabled={deleting}
          title="Delete image and label from dataset"
        >
          {deleting ? "…" : "Delete image"}
        </button>
        {message && <span style={{ color: message.startsWith("Delete") ? "var(--color-danger)" : "var(--color-success)" }}>{message}</span>}

        <span style={{ marginLeft: "auto", color: "var(--color-text-muted)", whiteSpace: "nowrap", fontSize: "0.8rem" }}>
          ← → navigate · Draw · Click to select/resize · 0–9 class · Del remove · Ctrl+S save
        </span>
      </div>

      {showTags && (
        <div style={{ padding: "0.5rem 0.75rem", borderBottom: "1px solid var(--color-border)", display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.5rem", background: "var(--color-bg)" }}>
          {tagList.map(([k, v], i) => (
            <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
              <input type="text" className="input" placeholder="key" value={k} onChange={(e) => updateTag(i, 0, e.target.value)} style={{ width: "90px", padding: "0.25rem 0.4rem" }} />
              <input type="text" className="input" placeholder="value" value={v} onChange={(e) => updateTag(i, 1, e.target.value)} style={{ width: "100px", padding: "0.25rem 0.4rem" }} />
              <button type="button" className="btn btn-ghost" style={{ padding: "0.2rem 0.4rem" }} onClick={() => removeTag(i)}>×</button>
            </span>
          ))}
          <button type="button" className="btn btn-ghost" style={{ padding: "0.25rem 0.5rem" }} onClick={addTag}>+ Tag</button>
          <button type="button" className="btn btn-primary" style={{ padding: "0.25rem 0.5rem" }} onClick={saveTags} disabled={saving}>Save tags</button>
        </div>
      )}

      {/* Canvas fills available space */}
      <div style={{ flex: 1, minHeight: 0, display: "flex", justifyContent: "center", alignItems: "center", padding: "0.5rem", overflow: "auto", background: "var(--color-border)" }}>
        <BBoxCanvas
          imageUrl={api.imageUrl(currentImage.split, currentImage.name)}
          boxes={boxes}
          classNames={classNames}
          selectedIndex={selectedIndex}
          defaultClassId={defaultClassId}
          focusedClassId={state?.classId != null ? parseInt(state.classId, 10) : null}
          classColors={classColors}
          onSelect={setSelectedIndex}
          onBoxesChange={setBoxes}
          fill
        />
      </div>

      <div style={{ minHeight: "44px", borderTop: "1px solid var(--color-border)", display: "flex", alignItems: "center", padding: "0.35rem 0.75rem", gap: "0.5rem", flexWrap: "wrap", background: "var(--color-surface)" }}>
        {selectedIndex !== null && boxes[selectedIndex] != null ? (
          <>
            <span style={{ fontSize: "0.85rem" }}>Class:</span>
            <select
              className="input"
              style={{ width: "auto", padding: "0.25rem 0.5rem" }}
              value={boxes[selectedIndex]!.classId}
              onChange={(e) => setBoxes((prev) => prev.map((b, i) => (i === selectedIndex ? { ...b, classId: parseInt(e.target.value, 10) } : b)))}
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <button type="button" className="btn btn-ghost" style={{ padding: "0.25rem 0.5rem" }} onClick={() => { setBoxes((prev) => prev.filter((_, i) => i !== selectedIndex)); setSelectedIndex(null); }}>Delete box</button>
          </>
        ) : (
          <span style={{ fontSize: "0.8rem", color: "var(--color-text-muted)" }}>Click a box to select and resize · Drag to draw new box</span>
        )}
      </div>
    </div>
  );
}
