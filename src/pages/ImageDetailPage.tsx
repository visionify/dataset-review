import { useEffect, useState, useCallback, useRef } from "react";
import { Link, useParams, useLocation, useNavigate } from "react-router-dom";
import { api, imageBase } from "@/api";
import { BBoxCanvas } from "@/components/BBoxCanvas";
import type { BBox, ImageItem, ClassItem } from "@/types";

const DEFAULT_CLASS_KEY = "pallet-review-default-class";
const LOAD_LIMIT = 5000;

export default function ImageDetailPage() {
  const { split, name } = useParams<{ split: string; name: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as { fromSplit?: string; filterReviewed?: string; classId?: string; startIndex?: number } | null;

  const fromSplit = state?.fromSplit ?? "all";
  const filterReviewed = state?.filterReviewed as "yes" | "no" | undefined;

  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [classColors, setClassColors] = useState<Record<number, string>>({});
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof api.getSummary>> | null>(null);
  const [allImages, setAllImages] = useState<ImageItem[]>([]);
  const [listReady, setListReady] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [boxes, setBoxes] = useState<BBox[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [defaultClassId, setDefaultClassIdState] = useState(0);
  const [showTags, setShowTags] = useState(false);
  const [tagList, setTagList] = useState<[string, string][]>([]);
  const [deleting, setDeleting] = useState(false);
  const boxesRef = useRef(boxes);
  boxesRef.current = boxes;

  const setDefaultClassId = useCallback((id: number) => {
    setDefaultClassIdState(id);
    try { localStorage.setItem(DEFAULT_CLASS_KEY, String(id)); } catch {}
  }, []);

  // Load persisted default class
  useEffect(() => {
    try {
      const s = localStorage.getItem(DEFAULT_CLASS_KEY);
      if (s != null) { const n = parseInt(s, 10); if (!isNaN(n)) setDefaultClassIdState(n); }
    } catch {}
  }, []);

  // Load summary + class colors once
  useEffect(() => {
    api.getSummary().then((s) => { setClasses(s.classes ?? []); setSummary(s); }).catch(() => {});
    api.getClassColors().then((c) => setClassColors(c || {})).catch(() => setClassColors({}));
  }, []);

  // Load full image list for the split — this enables seamless navigation
  useEffect(() => {
    setListReady(false);
    const loadAll = async () => {
      const all: ImageItem[] = [];
      let page = 1;
      let hasMore = true;
      while (hasMore) {
        const r = await api.getImages({ split: fromSplit, page, limit: LOAD_LIMIT, reviewed: filterReviewed });
        all.push(...r.images);
        hasMore = r.images.length === LOAD_LIMIT;
        page++;
      }
      setAllImages(all);
      if (split && name) {
        const idx = all.findIndex(img => img.split === split && img.name === name);
        setCurrentIdx(idx >= 0 ? idx : state?.startIndex ?? 0);
      } else {
        setCurrentIdx(state?.startIndex ?? 0);
      }
      setListReady(true);
    };
    loadAll().catch(() => setListReady(true));
  }, [fromSplit, filterReviewed]);

  const currentImage = allImages[currentIdx] ?? (split && name ? { split, name, imageRel: "", relPath: "" } : null);
  const hasPrev = currentIdx > 0;
  const hasNext = currentIdx < allImages.length - 1;

  // Load annotations + tags when image changes
  useEffect(() => {
    if (!currentImage) return;
    const s = currentImage.split;
    const b = imageBase(currentImage.name);
    setSelectedIndex(null);
    Promise.all([api.getAnnotations(s, b), api.getTags(s, b)]).then(([ann, t]) => {
      setBoxes(ann);
      const tagObj = (t && typeof t === "object" && !Array.isArray(t)) ? t as Record<string, unknown> : {};
      setTagList(Object.entries(tagObj).map(([k, v]) => [k, String(v ?? "")]));
    }).catch(() => { setBoxes([]); setTagList([]); });
    // Update URL to match current image (without full page reload)
    const url = `/image/${encodeURIComponent(s)}/${encodeURIComponent(currentImage.name)}`;
    if (location.pathname !== url)
      navigate(url, { replace: true, state: { fromSplit, filterReviewed, classId: state?.classId, startIndex: currentIdx } });
  }, [currentIdx, currentImage?.split, currentImage?.name]);

  const markReviewed = useCallback(() => {
    if (!currentImage) return;
    api.setReviewed(currentImage.split, imageBase(currentImage.name), true).catch(() => {});
  }, [currentImage]);

  const saveAnnotations = useCallback(async () => {
    if (!currentImage) return;
    setSaving(true); setMessage(null);
    try {
      await api.saveAnnotations(currentImage.split, imageBase(currentImage.name), boxesRef.current);
      markReviewed();
      setMessage("Saved & reviewed.");
      setTimeout(() => setMessage(null), 2000);
    } catch (e) { setMessage(e instanceof Error ? e.message : "Save failed"); }
    finally { setSaving(false); }
  }, [currentImage, markReviewed]);

  const saveTags = useCallback(async () => {
    if (!currentImage) return;
    const obj = Object.fromEntries(tagList.filter(([k]) => k.trim() !== ""));
    setSaving(true); setMessage(null);
    try { await api.saveTags(currentImage.split, imageBase(currentImage.name), obj); setMessage("Tags saved."); setTimeout(() => setMessage(null), 2000); }
    catch (e) { setMessage(e instanceof Error ? e.message : "Save failed"); }
    finally { setSaving(false); }
  }, [currentImage, tagList]);

  const autoSaveAndMark = useCallback(() => {
    if (!currentImage) return;
    const s = currentImage.split;
    const b = imageBase(currentImage.name);
    api.saveAnnotations(s, b, boxesRef.current).catch(() => {});
    api.setReviewed(s, b, true).catch(() => {});
  }, [currentImage]);

  const goNext = useCallback(() => {
    if (!hasNext) return;
    autoSaveAndMark();
    setCurrentIdx(i => i + 1);
  }, [hasNext, autoSaveAndMark]);

  const goPrev = useCallback(() => {
    if (!hasPrev) return;
    autoSaveAndMark();
    setCurrentIdx(i => i - 1);
  }, [hasPrev, autoSaveAndMark]);

  const handleThumbsUp = useCallback(() => {
    markReviewed();
    if (hasNext) setCurrentIdx(i => i + 1);
    else { setMessage("Marked as reviewed."); setTimeout(() => setMessage(null), 2000); }
  }, [markReviewed, hasNext]);

  const handleDeleteImage = useCallback(async () => {
    if (!currentImage) return;
    setDeleting(true);
    try {
      await api.deleteImage(currentImage.split, currentImage.name);
      const newList = allImages.filter((_, i) => i !== currentIdx);
      setAllImages(newList);
      if (newList.length === 0) { navigate(`/images/${fromSplit}`, { replace: true }); return; }
      setCurrentIdx(Math.min(currentIdx, newList.length - 1));
    } catch (e) { setMessage(e instanceof Error ? e.message : "Delete failed"); }
    finally { setDeleting(false); }
  }, [currentImage, allImages, currentIdx, fromSplit, navigate]);

  // Cycle class on selected box
  const cycleBoxClass = useCallback(() => {
    if (selectedIndex === null || !boxes[selectedIndex]) return;
    const maxClass = classes.length;
    if (!maxClass) return;
    setBoxes(prev => prev.map((b, i) => {
      if (i !== selectedIndex) return b;
      const next = (b.classId + 1) % maxClass;
      setDefaultClassId(next);
      return { ...b, classId: next };
    }));
  }, [selectedIndex, boxes, classes.length, setDefaultClassId]);

  // When a new box is created or a box class changes, update defaultClassId
  const handleBoxesChange = useCallback((newBoxes: BBox[]) => {
    if (newBoxes.length > boxes.length) {
      const last = newBoxes[newBoxes.length - 1];
      if (last) setDefaultClassId(last.classId);
    }
    setBoxes(newBoxes);
  }, [boxes.length, setDefaultClassId]);

  // When selected box class is changed via dropdown, update default
  const handleSelectedClassChange = useCallback((classId: number) => {
    if (selectedIndex === null) return;
    setBoxes(prev => prev.map((b, i) => i === selectedIndex ? { ...b, classId } : b));
    setDefaultClassId(classId);
  }, [selectedIndex, setDefaultClassId]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if (e.key === "d" && !e.ctrlKey && !e.metaKey && selectedIndex !== null) {
        e.preventDefault();
        setBoxes(prev => prev.filter((_, i) => i !== selectedIndex));
        setSelectedIndex(null);
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        if (selectedIndex !== null) {
          setBoxes(prev => prev.filter((_, i) => i !== selectedIndex));
          setSelectedIndex(null);
        } else {
          handleDeleteImage();
        }
        return;
      }
      if (e.ctrlKey && e.key === "s") { e.preventDefault(); saveAnnotations(); return; }
      if (e.key === "t" && !e.ctrlKey && !e.metaKey && !e.altKey) { setShowTags(s => !s); return; }
      if (e.key === "c" && !e.ctrlKey && !e.metaKey && selectedIndex !== null) { e.preventDefault(); cycleBoxClass(); return; }
      if (e.key === " ") { e.preventDefault(); handleThumbsUp(); return; }

      const num = parseInt(e.key, 10);
      if (e.key >= "1" && e.key <= "9" && num >= 1 && num <= 9 && selectedIndex !== null && classes.length >= num) {
        e.preventDefault();
        handleSelectedClassChange(num - 1);
      }
      if (e.key === "0" && selectedIndex !== null && classes.length > 0) {
        e.preventDefault();
        handleSelectedClassChange(0);
      }
      if (e.key === "ArrowLeft") { e.preventDefault(); goPrev(); }
      if (e.key === "ArrowRight") { e.preventDefault(); goNext(); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedIndex, saveAnnotations, classes.length, goPrev, goNext, handleDeleteImage, handleThumbsUp, cycleBoxClass, handleSelectedClassChange]);

  const addTag = () => setTagList(prev => [...prev, ["", ""]]);
  const updateTag = (i: number, k: 0 | 1, v: string) =>
    setTagList(prev => prev.map((row, j) => j === i ? (k === 0 ? [v, row[1]] : [row[0], v]) : row));
  const removeTag = (i: number) => setTagList(prev => prev.filter((_, j) => j !== i));

  if (!currentImage) {
    return (
      <div>
        <Link to={`/images/${fromSplit}`} className="btn btn-ghost">← Back</Link>
        <p style={{ marginTop: "1rem" }}>{listReady ? "No images found." : "Loading images…"}</p>
      </div>
    );
  }

  const classNames = Object.fromEntries(classes.map(c => [c.id, c.name]));
  const totalImages = summary?.totalImages ?? 0;
  const reviewedCount = summary?.reviewedCount ?? 0;
  const pctReviewed = totalImages ? Math.round((reviewedCount / totalImages) * 100) : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: "80vh" }}>
      {/* Compact toolbar */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.5rem", padding: "0.4rem 0.75rem", borderBottom: "1px solid var(--color-border)", background: "var(--color-surface)", fontSize: "0.85rem" }}>
        <Link to={`/images/${fromSplit}`} className="btn btn-ghost" style={{ padding: "0.3rem 0.5rem" }}>← Back</Link>

        <button className="btn btn-ghost" style={{ padding: "0.3rem 0.5rem" }} onClick={goPrev} disabled={!hasPrev}>←</button>
        <span style={{ color: "var(--color-text-muted)", fontVariantNumeric: "tabular-nums", minWidth: "5rem", textAlign: "center" }}>
          {currentIdx + 1} / {allImages.length}
        </span>
        <button className="btn btn-ghost" style={{ padding: "0.3rem 0.5rem" }} onClick={goNext} disabled={!hasNext}>→</button>

        <span style={{ color: "var(--color-text-muted)", fontSize: "0.8rem" }}>{pctReviewed}%</span>

        <select className="input" style={{ width: "auto", padding: "0.3rem 0.4rem", maxWidth: "120px" }} value={defaultClassId} onChange={e => setDefaultClassId(parseInt(e.target.value, 10))} title="Class for new boxes">
          {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        <button className="btn btn-primary" onClick={saveAnnotations} disabled={saving} style={{ padding: "0.3rem 0.6rem" }}>
          {saving ? "…" : "Save (Ctrl+S)"}
        </button>
        <button className="btn btn-ghost" onClick={handleThumbsUp} style={{ padding: "0.3rem 0.5rem", fontSize: "1.1rem" }} title="Mark reviewed & next (Space)">
          👍
        </button>
        <button className="btn btn-ghost" style={{ padding: "0.3rem 0.5rem", color: "var(--color-danger)" }} onClick={handleDeleteImage} disabled={deleting} title="Delete image (Del when no box selected)">
          {deleting ? "…" : "🗑"}
        </button>
        <button className="btn btn-ghost" onClick={() => setShowTags(s => !s)} style={{ padding: "0.3rem 0.5rem" }}>
          Tags {showTags ? "▼" : "▶"}
        </button>

        {message && <span style={{ color: "var(--color-success)", fontSize: "0.8rem" }}>{message}</span>}

        <span style={{ marginLeft: "auto", color: "var(--color-text-muted)", whiteSpace: "nowrap", fontSize: "0.75rem" }}>
          ← → auto-save & nav · Space approve · D delete box · Del delete image · C cycle class · 0-9 set class
        </span>
      </div>

      {showTags && (
        <div style={{ padding: "0.4rem 0.75rem", borderBottom: "1px solid var(--color-border)", display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.5rem", background: "var(--color-bg)" }}>
          {tagList.map(([k, v], i) => (
            <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
              <input type="text" className="input" placeholder="key" value={k} onChange={e => updateTag(i, 0, e.target.value)} style={{ width: "90px", padding: "0.25rem 0.4rem" }} />
              <input type="text" className="input" placeholder="value" value={v} onChange={e => updateTag(i, 1, e.target.value)} style={{ width: "100px", padding: "0.25rem 0.4rem" }} />
              <button type="button" className="btn btn-ghost" style={{ padding: "0.2rem 0.4rem" }} onClick={() => removeTag(i)}>×</button>
            </span>
          ))}
          <button type="button" className="btn btn-ghost" style={{ padding: "0.25rem 0.5rem" }} onClick={addTag}>+ Tag</button>
          <button type="button" className="btn btn-primary" style={{ padding: "0.25rem 0.5rem" }} onClick={saveTags} disabled={saving}>Save tags</button>
        </div>
      )}

      {/* Canvas */}
      <div style={{ flex: 1, minHeight: 0, display: "flex", justifyContent: "center", alignItems: "center", padding: "0.25rem", overflow: "hidden", background: "var(--color-border)" }}>
        <BBoxCanvas
          imageUrl={api.imageUrl(currentImage.split, currentImage.name)}
          boxes={boxes}
          classNames={classNames}
          selectedIndex={selectedIndex}
          defaultClassId={defaultClassId}
          focusedClassId={state?.classId != null ? parseInt(state.classId, 10) : null}
          classColors={classColors}
          onSelect={setSelectedIndex}
          onBoxesChange={handleBoxesChange}
          onDoubleClickBox={cycleBoxClass}
          fill
        />
      </div>

      {/* Bottom status */}
      <div style={{ minHeight: "36px", borderTop: "1px solid var(--color-border)", display: "flex", alignItems: "center", padding: "0.25rem 0.75rem", gap: "0.5rem", flexWrap: "wrap", background: "var(--color-surface)", fontSize: "0.85rem" }}>
        {selectedIndex !== null && boxes[selectedIndex] != null ? (
          <>
            <span>Class:</span>
            <select className="input" style={{ width: "auto", padding: "0.2rem 0.4rem" }} value={boxes[selectedIndex]!.classId} onChange={e => handleSelectedClassChange(parseInt(e.target.value, 10))}>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <button type="button" className="btn btn-ghost" style={{ padding: "0.2rem 0.4rem" }} onClick={() => { setBoxes(prev => prev.filter((_, i) => i !== selectedIndex)); setSelectedIndex(null); }}>Delete box</button>
            <span style={{ color: "var(--color-text-muted)", fontSize: "0.8rem" }}>C to cycle class</span>
          </>
        ) : (
          <span style={{ color: "var(--color-text-muted)", fontSize: "0.8rem" }}>Drag to draw · Click box to select/resize · D delete box · Space = approve & next</span>
        )}
      </div>
    </div>
  );
}
