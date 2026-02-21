export interface ClassItem {
  id: number;
  name: string;
}

export interface ImageItem {
  split: string;
  name: string;
  relPath: string;
  imageRel: string;
}

export interface BBox {
  classId: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ImageTags {
  day?: boolean;
  night?: boolean;
  camera?: string;
  client?: string;
  [key: string]: string | boolean | undefined;
}

export interface DatasetConfig {
  datasetPath: string;
  configured: boolean;
}

export interface DatasetResponse {
  configured: boolean;
  classes: ClassItem[];
  images: ImageItem[];
  samplesByClass: Record<number | string, ImageItem[]>;
  imageClassIds?: Record<string, number[]>;
  config: { train: string; val: string; test: string | null; names: Record<number, string> } | null;
  metadata: Record<string, unknown>;
  error?: string;
}

export interface ValidationCheck {
  id: string;
  name: string;
  count: number;
  severity: "ok" | "warning" | "info";
  detail: string[] | Record<string, number>;
}
