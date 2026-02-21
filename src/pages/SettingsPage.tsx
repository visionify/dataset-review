import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/api";
import { getClassColor } from "@/classColors";
import type { ClassItem } from "@/types";

const DEFAULT_PALETTE = [
  "#e6194b", "#3cb44b", "#4363d8", "#f58231", "#911eb4",
  "#42d4f4", "#f032e6", "#bfef45", "#469990", "#dcbeff",
  "#9a6324", "#800000", "#aaffc3", "#808000", "#ffd8b1", "#000075",
];

export default function SettingsPage() {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [colors, setColors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    api.getSummary().then((s) => setClasses(s.classes ?? [])).catch(() => {});
    api.getClassColors().then((c) => setColors(c || {})).catch(() => setColors({}));
  }, []);

  const getColor = (classId: number) => {
    const key = String(classId);
    if (colors[key]) return colors[key];
    return DEFAULT_PALETTE[classId % DEFAULT_PALETTE.length] ?? getClassColor(classId, null);
  };

  const setColor = (classId: number, hex: string) => {
    setColors((prev) => ({ ...prev, [String(classId)]: hex }));
  };

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const body: Record<string, string> = {};
      Object.entries(colors).forEach(([k, v]) => {
        if (v) body[k] = v;
      });
      await api.setClassColors(body as Record<number, string>);
      setMessage("Colors saved.");
      setTimeout(() => setMessage(null), 2000);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setColors({});
  };

  return (
    <div className="card" style={{ padding: "1.5rem", maxWidth: "32rem" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem", flexWrap: "wrap", gap: "0.5rem" }}>
        <h1 style={{ fontSize: "1.25rem" }}>Settings</h1>
        <Link to="/" className="btn btn-ghost" style={{ padding: "0.35rem 0.5rem" }}>← Back</Link>
      </div>
      <p style={{ color: "var(--color-text-muted)", fontSize: "0.9rem", marginBottom: "1rem" }}>
        Set a color for each class. These colors are used for bounding boxes in the annotator. Default palette is used until you save custom colors.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        {classes.map((cls) => (
          <div key={cls.id} style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 4,
                background: getColor(cls.id),
                border: "1px solid var(--color-border)",
              }}
            />
            <span style={{ minWidth: "8rem", fontWeight: 500 }}>{cls.name}</span>
            <input
              type="color"
              value={getColor(cls.id)}
              onChange={(e) => setColor(cls.id, e.target.value)}
              style={{ width: 40, height: 28, padding: 0, border: "none", cursor: "pointer", borderRadius: 4 }}
            />
            <input
              type="text"
              className="input"
              value={getColor(cls.id)}
              onChange={(e) => setColor(cls.id, e.target.value)}
              style={{ width: 90, padding: "0.35rem 0.5rem", fontSize: "0.85rem" }}
            />
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
        <button className="btn btn-primary" onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save colors"}
        </button>
        <button className="btn btn-ghost" onClick={reset}>Reset to defaults</button>
      </div>
      {message && (
        <p style={{ marginTop: "0.75rem", fontSize: "0.9rem", color: "var(--color-text-muted)" }}>{message}</p>
      )}
    </div>
  );
}
