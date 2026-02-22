import type { BBox, ImageTags, ValidationCheck, ImageItem, ClassItem } from "./types";

const BASE = "/api";

async function get<T>(path: string): Promise<T> {
  const r = await fetch(BASE + path);
  if (!r.ok) throw new Error(await r.text().catch(() => r.statusText));
  return r.json();
}

async function put<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(BASE + path, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(await r.text().catch(() => r.statusText));
  return r.json();
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(BASE + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(await r.text().catch(() => r.statusText));
  return r.json();
}

async function patch<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(BASE + path, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(await r.text().catch(() => r.statusText));
  return r.json();
}

export interface DatasetSummary {
  configured: boolean;
  classes: ClassItem[];
  config: { train: string; val: string; test: string | null; names: Record<number, string> } | null;
  totalImages: number;
  reviewedCount?: number;
  splitCounts?: Record<string, number>;
  missingLabelsCount?: number;
  emptyLabelsCount?: number;
}

export const api = {
  getConfig: () => get<{ datasetPath: string; configured: boolean }>("/config"),
  setConfig: (path: string) => post<{ ok: boolean }>("/config", { path }),
  getSummary: () => get<DatasetSummary>("/dataset/summary"),
  getValidation: () => get<{ checks: ValidationCheck[] }>("/validation"),
  getImages: (opts: { split?: string; page?: number; limit?: number; reviewed?: "yes" | "no" }) => {
    const p = new URLSearchParams();
    if (opts.split) p.set("split", opts.split);
    if (opts.page != null) p.set("page", String(opts.page));
    if (opts.limit != null) p.set("limit", String(opts.limit));
    if (opts.reviewed) p.set("reviewed", opts.reviewed);
    return get<{ images: ImageItem[]; total: number }>(`/images?${p}`);
  },
  getReviewed: () => get<{ reviewed: string[] }>("/reviewed"),
  setReviewed: (split: string, base: string, reviewed: boolean) =>
    patch<{ reviewed: string[] }>("/reviewed", { split, base, reviewed }),
  getClassColors: () => get<Record<number, string>>("/class-colors"),
  setClassColors: (colors: Record<number, string>) => put<Record<number, string>>("/class-colors", colors),
  deleteImage: (split: string, name: string) => {
    return fetch(`/api/images/${encodeURIComponent(split)}/${encodeURIComponent(name)}`, { method: "DELETE" }).then((r) => {
      if (!r.ok) throw new Error(r.statusText);
      return r.json();
    });
  },
  getClassImages: (classId: number, page: number, limit: number) =>
    get<{ images: ImageItem[]; total: number }>(`/class/${classId}/images?page=${page}&limit=${limit}`),
  getClassSamples: (classId: number, limit?: number) =>
    get<{ samples: ImageItem[] }>(`/class/${classId}/samples?limit=${limit ?? 8}`),
  imageUrl: (split: string, name: string) => `/api/images/${encodeURIComponent(split)}/${encodeURIComponent(name)}`,
  assetUrl: (relPath: string) => `/dataset-asset/${relPath.replace(/^\//, "")}`,
  getAnnotations: (split: string, base: string) =>
    get<BBox[]>(`/annotations/${encodeURIComponent(split)}/${encodeURIComponent(base)}`),
  saveAnnotations: (split: string, base: string, boxes: BBox[]) =>
    put<{ ok: boolean }>(`/annotations/${encodeURIComponent(split)}/${encodeURIComponent(base)}`, boxes),
  getTags: (split: string, base: string) =>
    get<ImageTags>(`/tags/${encodeURIComponent(split)}/${encodeURIComponent(base)}`),
  saveTags: (split: string, base: string, tags: ImageTags) =>
    put<{ ok: boolean }>(`/tags/${encodeURIComponent(split)}/${encodeURIComponent(base)}`, tags),
  patchMetadata: (data: Record<string, unknown>) => patch<Record<string, unknown>>("/metadata", data),
};

export function imageBase(name: string): string {
  const lastDot = name.lastIndexOf(".");
  return lastDot > 0 ? name.slice(0, lastDot) : name;
}
