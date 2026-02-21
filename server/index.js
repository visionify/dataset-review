import express from "express";
import cors from "cors";
import fs from "fs/promises";
import fsSync from "fs";
import path from "path";
import { fileURLToPath } from "url";
import yaml from "js-yaml";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = 3456;

app.use(cors());
app.use(express.json());

const CONFIG_PATH = path.join(__dirname, "..", "dataset-path.json");
const DEFAULT_DATASET_PATH = process.env.DATASET_PATH || "";

function getDatasetPath() {
  try {
    const raw = fsSync.readFileSync(CONFIG_PATH, "utf8");
    const data = JSON.parse(raw);
    return data.path || DEFAULT_DATASET_PATH;
  } catch {
    return DEFAULT_DATASET_PATH;
  }
}

function setDatasetPath(newPath) {
  return fs.writeFile(
    CONFIG_PATH,
    JSON.stringify({ path: newPath }, null, 2),
    "utf8"
  );
}

function getReviewDir(datasetRoot) {
  return path.join(datasetRoot, "review");
}

function getTagsDir(datasetRoot) {
  return path.join(getReviewDir(datasetRoot), "tags");
}

function getMetadataPath(datasetRoot) {
  return path.join(getReviewDir(datasetRoot), "metadata.json");
}

function getReviewedPath(datasetRoot) {
  return path.join(getReviewDir(datasetRoot), "reviewed.json");
}

function getClassColorsPath(datasetRoot) {
  return path.join(getReviewDir(datasetRoot), "class-colors.json");
}

async function readReviewedSet(datasetRoot) {
  try {
    const content = await fs.readFile(getReviewedPath(datasetRoot), "utf8");
    const data = JSON.parse(content);
    return new Set(Array.isArray(data) ? data : data.reviewed || []);
  } catch {
    return new Set();
  }
}

async function ensureReviewDirs(datasetRoot) {
  const reviewDir = getReviewDir(datasetRoot);
  const tagsDir = getTagsDir(datasetRoot);
  await fs.mkdir(reviewDir, { recursive: true });
  await fs.mkdir(tagsDir, { recursive: true });
}

function normalizeClassNames(data) {
  const raw = data.names;
  if (Array.isArray(raw)) {
    return Object.fromEntries(raw.map((name, i) => [i, String(name)]));
  }
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return Object.fromEntries(
      Object.entries(raw).map(([k, v]) => [parseInt(k, 10), String(v)])
    );
  }
  if (data.nc != null) {
    const n = parseInt(data.nc, 10);
    return Object.fromEntries(Array.from({ length: n }, (_, i) => [i, `class_${i}`]));
  }
  return {};
}

async function parseDataYaml(datasetRoot) {
  const yamlPath = path.join(datasetRoot, "data.yaml");
  try {
    const content = await fs.readFile(yamlPath, "utf8");
    const data = yaml.load(content);
    const names = normalizeClassNames(data);
    const trainPath = typeof data.train === "string" ? data.train : (data.train && data.train[0]) || "images/train";
    const valPath = typeof data.val === "string" ? data.val : (data.val && data.val[0]) || "images/val";
    const testPath = typeof data.test === "string" ? data.test : (data.test && data.test[0]) || null;
    return {
      names,
      train: trainPath,
      val: valPath,
      test: testPath,
    };
  } catch (e) {
    return {
      names: {},
      train: "images/train",
      val: "images/val",
      test: null,
    };
  }
}

function getLabelsPath(datasetRoot, split, imageRelPath) {
  const base = path.basename(imageRelPath, path.extname(imageRelPath));
  const labelsDir = path.join(datasetRoot, "labels", split);
  return path.join(labelsDir, base + ".txt");
}

function getSplitFromRelPath(relPath) {
  const parts = relPath.split(path.sep);
  if (parts[0] === "images" && parts[1]) return parts[1];
  return "train";
}

async function listImagesInDir(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const exts = new Set([".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp"]);
  const files = [];
  for (const e of entries) {
    if (!e.isFile()) continue;
    const ext = path.extname(e.name).toLowerCase();
    if (exts.has(ext)) files.push(e.name);
  }
  return files.sort();
}

async function collectAllImages(datasetRoot, config) {
  const splits = ["train", "val", "test"].filter((s) => config[s]);
  const result = [];
  for (const split of splits) {
    const imagesDir = path.join(datasetRoot, config[split]);
    try {
      const files = await listImagesInDir(imagesDir);
      for (const f of files) {
        result.push({
          split,
          name: f,
          relPath: path.join(path.basename(path.dirname(config[split])), path.basename(config[split]), f).replace(/\\/g, "/"),
          imageRel: path.join(config[split], f).replace(/\\/g, "/"),
        });
      }
    } catch (_) {}
  }
  return result;
}

async function countImages(datasetRoot, config) {
  const splits = ["train", "val", "test"].filter((s) => config[s]);
  let total = 0;
  for (const split of splits) {
    const imagesDir = path.join(datasetRoot, config[split]);
    try {
      const files = await listImagesInDir(imagesDir);
      total += files.length;
    } catch (_) {}
  }
  return total;
}

async function getImagesPaginated(datasetRoot, config, split, page, limit, reviewedFilter) {
  const splits = split && split !== "all" ? [split].filter((s) => config[s]) : ["train", "val", "test"].filter((s) => config[s]);
  const all = [];
  for (const s of splits) {
    const imagesDir = path.join(datasetRoot, config[s]);
    try {
      const files = await listImagesInDir(imagesDir);
      for (const f of files) {
        const base = path.basename(f, path.extname(f));
        const key = `${s}/${base}`;
        all.push({ split: s, name: f, base, key, imageRel: path.join(config[s], f).replace(/\\/g, "/"), relPath: path.join(config[s], f).replace(/\\/g, "/") });
      }
    } catch (_) {}
  }
  let filtered = all;
  if (reviewedFilter === "no") {
    const reviewed = await readReviewedSet(datasetRoot);
    filtered = all.filter((img) => !reviewed.has(img.key));
  } else if (reviewedFilter === "yes") {
    const reviewed = await readReviewedSet(datasetRoot);
    filtered = all.filter((img) => reviewed.has(img.key));
  }
  const total = filtered.length;
  const start = (page - 1) * limit;
  const images = filtered.slice(start, start + limit).map(({ split: s, name, imageRel, relPath }) => ({ split: s, name, imageRel, relPath }));
  return { images, total };
}

let classIndexCache = null;
let classIndexCachePath = null;

async function buildClassIndex(datasetRoot, config) {
  if (classIndexCache && classIndexCachePath === datasetRoot) return classIndexCache;
  const imageClassIds = {};
  const splits = ["train", "val", "test"].filter((s) => config[s]);
  for (const split of splits) {
    const imagesDir = path.join(datasetRoot, config[split]);
    const labelsDir = path.join(datasetRoot, "labels", split);
    let files = [];
    try {
      files = await listImagesInDir(imagesDir);
    } catch (_) {}
    for (const f of files) {
      const imageRel = path.join(config[split], f).replace(/\\/g, "/");
      const base = path.basename(f, path.extname(f));
      const labelPath = path.join(labelsDir, base + ".txt");
      let ids = [];
      try {
        const content = await fs.readFile(labelPath, "utf8");
        ids = [...new Set(content.split("\n").map((l) => l.trim().split(/\s+/)[0]).filter(Boolean).map((c) => parseInt(c, 10)))];
      } catch (_) {}
      imageClassIds[imageRel] = ids;
    }
  }
  classIndexCache = imageClassIds;
  classIndexCachePath = datasetRoot;
  return imageClassIds;
}

app.get("/api/config", async (_req, res) => {
  const path_ = getDatasetPath();
  res.json({ datasetPath: path_, configured: !!path_.trim() });
});

app.post("/api/config", async (req, res) => {
  try {
    const { path: newPath } = req.body;
    if (typeof newPath !== "string") return res.status(400).json({ error: "path required" });
    await setDatasetPath(newPath.trim());
    await ensureReviewDirs(newPath.trim());
    classIndexCache = null;
    classIndexCachePath = null;
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e.message) });
  }
});

app.get("/api/dataset/summary", async (_req, res) => {
  const datasetRoot = getDatasetPath();
  if (!datasetRoot.trim()) return res.json({ configured: false, classes: [], config: null, totalImages: 0, reviewedCount: 0 });
  try {
    await ensureReviewDirs(datasetRoot);
    const config = await parseDataYaml(datasetRoot);
    const totalImages = await countImages(datasetRoot, config);
    const reviewed = await readReviewedSet(datasetRoot);
    const classes = Object.entries(config.names).map(([id, name]) => ({
      id: parseInt(id, 10),
      name: String(name),
    })).sort((a, b) => a.id - b.id);
    res.json({
      configured: true,
      classes,
      config: { train: config.train, val: config.val, test: config.test, names: config.names },
      totalImages,
      reviewedCount: reviewed.size,
    });
  } catch (e) {
    res.status(500).json({ error: String(e.message), configured: true });
  }
});

app.get("/api/images", async (req, res) => {
  const datasetRoot = getDatasetPath();
  if (!datasetRoot.trim()) return res.json({ images: [], total: 0 });
  try {
    const config = await parseDataYaml(datasetRoot);
    const split = req.query.split || "all";
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 24));
    const reviewed = req.query.reviewed; // "yes" | "no" | omit
    const { images, total } = await getImagesPaginated(datasetRoot, config, split, page, limit, reviewed);
    res.json({ images, total });
  } catch (e) {
    res.status(500).json({ images: [], total: 0 });
  }
});

app.get("/api/class/:id/images", async (req, res) => {
  const datasetRoot = getDatasetPath();
  if (!datasetRoot.trim()) return res.json({ images: [], total: 0 });
  try {
    const config = await parseDataYaml(datasetRoot);
    const classId = parseInt(req.params.id, 10);
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 24));
    const index = await buildClassIndex(datasetRoot, config);
    const imageRels = Object.entries(index).filter(([, ids]) => ids.includes(classId)).map(([rel]) => rel);
    const splits = ["train", "val", "test"].filter((s) => config[s]);
    const images = [];
    for (const rel of imageRels) {
      const parts = rel.split("/");
      const name = parts[parts.length - 1];
      const split = parts.length > 2 ? parts[1] : "train";
      images.push({ split, name, imageRel: rel, relPath: rel });
    }
    const start = (page - 1) * limit;
    const paginated = images.slice(start, start + limit);
    res.json({ images: paginated, total: images.length });
  } catch (e) {
    res.status(500).json({ images: [], total: 0 });
  }
});

app.get("/api/class/:id/samples", async (req, res) => {
  const datasetRoot = getDatasetPath();
  if (!datasetRoot.trim()) return res.json({ samples: [] });
  try {
    const config = await parseDataYaml(datasetRoot);
    const classId = parseInt(req.params.id, 10);
    const limit = Math.min(12, Math.max(1, parseInt(req.query.limit, 10) || 8));
    const index = await buildClassIndex(datasetRoot, config);
    const imageRels = Object.entries(index).filter(([, ids]) => ids.includes(classId)).map(([rel]) => rel).slice(0, limit);
    const samples = imageRels.map((rel) => {
      const parts = rel.split("/");
      const name = parts[parts.length - 1];
      const split = parts.length > 2 ? parts[1] : "train";
      return { split, name, imageRel: rel, relPath: rel };
    });
    res.json({ samples });
  } catch (e) {
    res.json({ samples: [] });
  }
});

app.get("/api/images/:split/:name", (req, res) => {
  const datasetRoot = getDatasetPath();
  const { split, name } = req.params;
  const imagePath = path.join(datasetRoot, "images", split, name);
  res.sendFile(imagePath, (err) => {
    if (err) res.status(404).end();
  });
});

app.get("/dataset-asset/*", (req, res) => {
  const datasetRoot = getDatasetPath();
  const sub = req.params[0];
  if (!sub) return res.status(400).end();
  const full = path.join(datasetRoot, sub);
  if (!full.startsWith(path.resolve(datasetRoot))) return res.status(403).end();
  res.sendFile(full, (err) => {
    if (err) res.status(404).end();
  });
});

app.get("/api/annotations/:split/:base", async (req, res) => {
  const datasetRoot = getDatasetPath();
  const { split, base: baseParam } = req.params;
  const base = path.basename(baseParam, path.extname(baseParam));
  const labelPath = path.join(datasetRoot, "labels", split, base + ".txt");
  try {
    const content = await fs.readFile(labelPath, "utf8");
    const lines = content.split("\n").filter((l) => l.trim());
    const boxes = lines.map((line) => {
      const parts = line.trim().split(/\s+/).map(Number);
      return { classId: parts[0], x: parts[1], y: parts[2], w: parts[3], h: parts[4] };
    });
    res.json(boxes);
  } catch {
    res.json([]);
  }
});

app.put("/api/annotations/:split/:base", async (req, res) => {
  const datasetRoot = getDatasetPath();
  const { split, base: baseParam } = req.params;
  const base = path.basename(baseParam, path.extname(baseParam));
  const labelsDir = path.join(datasetRoot, "labels", split);
  await fs.mkdir(labelsDir, { recursive: true });
  const labelPath = path.join(labelsDir, base + ".txt");
  const boxes = req.body;
  if (!Array.isArray(boxes)) return res.status(400).json({ error: "array of boxes required" });
  const lines = boxes.map((b) => `${b.classId} ${b.x} ${b.y} ${b.w} ${b.h}`).join("\n");
  await fs.writeFile(labelPath, lines, "utf8");
  res.json({ ok: true });
  try {
    const metadataPath = getMetadataPath(datasetRoot);
    let meta = {};
    try {
      meta = JSON.parse(await fs.readFile(metadataPath, "utf8"));
    } catch (_) {}
    meta.lastSavedAnnotation = { split, base, at: new Date().toISOString() };
    await fs.writeFile(metadataPath, JSON.stringify(meta, null, 2), "utf8");
  } catch (_) {}
});

function tagFilePath(datasetRoot, imageRelPath) {
  const base = path.basename(imageRelPath, path.extname(imageRelPath));
  return path.join(getTagsDir(datasetRoot), base + ".json");
}

app.get("/api/tags/:split/:base", async (req, res) => {
  const datasetRoot = getDatasetPath();
  const base = path.basename(req.params.base, path.extname(req.params.base));
  const relPath = `images/${req.params.split}/${base}`;
  const tagPath = tagFilePath(datasetRoot, relPath);
  try {
    const content = await fs.readFile(tagPath, "utf8");
    res.json(JSON.parse(content));
  } catch {
    res.json({});
  }
});

app.put("/api/tags/:split/:base", async (req, res) => {
  const datasetRoot = getDatasetPath();
  await ensureReviewDirs(datasetRoot);
  const base = path.basename(req.params.base, path.extname(req.params.base));
  const relPath = `images/${req.params.split}/${base}`;
  const tagPath = tagFilePath(datasetRoot, relPath);
  const body = req.body;
  if (typeof body !== "object" || body === null) return res.status(400).json({ error: "object required" });
  await fs.writeFile(tagPath, JSON.stringify(body, null, 2), "utf8");
  res.json({ ok: true });
});

app.get("/api/validation", async (_req, res) => {
  const datasetRoot = getDatasetPath();
  if (!datasetRoot.trim()) return res.json({ checks: [] });
  try {
    const config = await parseDataYaml(datasetRoot);
    const images = await collectAllImages(datasetRoot, config);
    const checks = [];
    const missingLabels = [];
    const emptyLabels = [];
    const classCounts = {};
    for (const img of images) {
      const labelPath = getLabelsPath(datasetRoot, img.split, img.imageRel);
      let hasLabel = false;
      try {
        const content = await fs.readFile(labelPath, "utf8");
        const lines = content.split("\n").filter((l) => l.trim());
        hasLabel = true;
        if (lines.length === 0) emptyLabels.push(img.imageRel);
        for (const line of lines) {
          const c = parseInt(line.trim().split(/\s+/)[0], 10);
          classCounts[c] = (classCounts[c] || 0) + 1;
        }
      } catch {
        missingLabels.push(img.imageRel);
      }
    }
    checks.push({
      id: "missing_labels",
      name: "Images without label file",
      count: missingLabels.length,
      severity: missingLabels.length > 0 ? "warning" : "ok",
      detail: missingLabels.slice(0, 20),
    });
    checks.push({
      id: "empty_labels",
      name: "Label files with no objects",
      count: emptyLabels.length,
      severity: "info",
      detail: emptyLabels.slice(0, 20),
    });
    checks.push({
      id: "class_balance",
      name: "Class distribution",
      count: Object.keys(classCounts).length,
      severity: "ok",
      detail: classCounts,
    });
    res.json({ checks });
  } catch (e) {
    res.status(500).json({ error: String(e.message) });
  }
});

app.patch("/api/metadata", async (req, res) => {
  const datasetRoot = getDatasetPath();
  if (!datasetRoot.trim()) return res.status(400).json({ error: "no dataset" });
  await ensureReviewDirs(datasetRoot);
  const metaPath = getMetadataPath(datasetRoot);
  let meta = {};
  try {
    meta = JSON.parse(await fs.readFile(metaPath, "utf8"));
  } catch (_) {}
  Object.assign(meta, req.body);
  await fs.writeFile(metaPath, JSON.stringify(meta, null, 2), "utf8");
  res.json(meta);
});

app.get("/api/reviewed", async (_req, res) => {
  const datasetRoot = getDatasetPath();
  if (!datasetRoot.trim()) return res.json({ reviewed: [] });
  try {
    const set = await readReviewedSet(datasetRoot);
    res.json({ reviewed: [...set] });
  } catch {
    res.json({ reviewed: [] });
  }
});

app.patch("/api/reviewed", async (req, res) => {
  const datasetRoot = getDatasetPath();
  if (!datasetRoot.trim()) return res.status(400).json({ error: "no dataset" });
  await ensureReviewDirs(datasetRoot);
  const { split, base, reviewed: mark } = req.body;
  if (!split || base == null) return res.status(400).json({ error: "split and base required" });
  const key = `${split}/${typeof base === "string" ? base.replace(/\.[^.]+$/, "") : base}`;
  const path_ = getReviewedPath(datasetRoot);
  let data = { reviewed: [] };
  try {
    data = JSON.parse(await fs.readFile(path_, "utf8"));
    if (!Array.isArray(data.reviewed)) data.reviewed = [];
  } catch (_) {}
  const set = new Set(data.reviewed);
  if (mark) set.add(key);
  else set.delete(key);
  data.reviewed = [...set];
  await fs.writeFile(path_, JSON.stringify(data, null, 2), "utf8");
  res.json({ reviewed: data.reviewed });
});

app.get("/api/class-colors", async (_req, res) => {
  const datasetRoot = getDatasetPath();
  if (!datasetRoot.trim()) return res.json({});
  try {
    const content = await fs.readFile(getClassColorsPath(datasetRoot), "utf8");
    res.json(JSON.parse(content));
  } catch {
    res.json({});
  }
});

app.put("/api/class-colors", async (req, res) => {
  const datasetRoot = getDatasetPath();
  if (!datasetRoot.trim()) return res.status(400).json({ error: "no dataset" });
  await ensureReviewDirs(datasetRoot);
  const body = req.body;
  if (typeof body !== "object" || body === null) return res.status(400).json({ error: "object required" });
  const path_ = getClassColorsPath(datasetRoot);
  await fs.writeFile(path_, JSON.stringify(body, null, 2), "utf8");
  res.json(body);
});

app.delete("/api/images/:split/:name", async (req, res) => {
  const datasetRoot = getDatasetPath();
  if (!datasetRoot.trim()) return res.status(400).json({ error: "no dataset" });
  const { split, name } = req.params;
  const config = await parseDataYaml(datasetRoot);
  const imagesDir = path.join(datasetRoot, config[split] || path.join("images", split));
  const imagePath = path.join(imagesDir, name);
  const base = path.basename(name, path.extname(name));
  const labelsDir = path.join(datasetRoot, "labels", split);
  const labelPath = path.join(labelsDir, base + ".txt");
  if (!imagePath.startsWith(path.resolve(datasetRoot))) return res.status(403).json({ error: "forbidden" });
  try {
    await fs.unlink(imagePath);
  } catch (e) {
    if (e.code !== "ENOENT") return res.status(500).json({ error: String(e.message) });
  }
  try {
    await fs.unlink(labelPath);
  } catch (_) {}
  const key = `${split}/${base}`;
  const reviewedPath = getReviewedPath(datasetRoot);
  try {
    const data = JSON.parse(await fs.readFile(reviewedPath, "utf8"));
    if (Array.isArray(data.reviewed)) {
      data.reviewed = data.reviewed.filter((k) => k !== key);
      await fs.writeFile(reviewedPath, JSON.stringify(data, null, 2), "utf8");
    }
  } catch (_) {}
  classIndexCache = null;
  classIndexCachePath = null;
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Dataset API at http://localhost:${PORT}`);
});
