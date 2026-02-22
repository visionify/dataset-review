# YOLO Dataset Review

Local web app for reviewing, annotating, and cleaning YOLO-format datasets. React + Vite frontend, Express backend for filesystem access.

## Setup

```bash
npm install
npm run dev          # starts both API server (:3456) and Vite dev server (:5173)
```

Open http://localhost:5173, go to **Dataset**, paste your dataset's absolute path (or drag-drop the folder).

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` | API + Vite (concurrently) |
| `npm run dev:server` | API only (port 3456) |
| `npm run dev:vite` | Vite only (port 5173) |
| `npm run build` | TypeScript check + Vite production build |

## Dataset layout

Supports both standard and Roboflow-style structures. The server auto-detects `data.yaml` / `dataset.yaml` / `dataset_weighted.yaml` and probes common directory patterns.

```
/path/to/dataset/
├── data.yaml              # or dataset.yaml
├── images/train/           # or train/images/
├── images/val/             # or valid/images/
├── labels/train/           # or train/labels/
├── labels/val/             # or valid/labels/
└── review/                 # created by this app
    ├── reviewed.json       # set of reviewed image keys
    ├── class-colors.json   # user-configured class colors
    ├── metadata.json
    └── tags/               # per-image JSON tags
```

## Architecture

```
server/index.js          Express API — file I/O, YAML parsing, image/label CRUD
src/
  api.ts                 Typed fetch wrappers for all API endpoints
  types.ts               Shared TypeScript interfaces
  classColors.ts         Default color palette
  components/
    Layout.tsx           App shell — header, nav tabs
    BBoxCanvas.tsx       Image viewer + SVG bbox drawing/resizing
  pages/
    ClassesPage.tsx      Dashboard — stats, class cards with samples
    ImagesPage.tsx       Paginated image grid per split (train/val/test/all)
    ImageDetailPage.tsx  Single-image annotation view
    ValidationPage.tsx   Missing labels, empty labels, class distribution
    ConfigPage.tsx       Set dataset path (paste or drag-drop)
    SettingsPage.tsx     Class color configuration
    ClassDetailPage.tsx  All images for one class
```

## Keyboard shortcuts (annotation view)

| Key | Action |
|---|---|
| `← →` | Auto-save, mark reviewed, navigate prev/next |
| `Space` | Mark reviewed and go to next (thumbs-up) |
| `D` | Delete selected bounding box |
| `C` | Cycle selected box's class |
| `Delete` | Delete selected box, or delete image if no box selected |
| `0-9` | Set selected box's class |
| `Ctrl+S` | Manual save |
| `T` | Toggle tags panel |
| Double-click bbox | Cycle class |

## API endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/config` | Current dataset path |
| POST | `/api/config` | Set dataset path |
| GET | `/api/dataset/summary` | Stats: classes, counts, reviewed |
| GET | `/api/images?split=&page=&limit=&reviewed=` | Paginated image list |
| GET | `/api/images/:split/:name` | Serve image file |
| DELETE | `/api/images/:split/:name` | Delete image + label |
| GET/PUT | `/api/annotations/:split/:base` | YOLO bbox annotations |
| GET/PUT | `/api/tags/:split/:base` | Per-image tags |
| GET/PATCH | `/api/reviewed` | Reviewed image tracking |
| GET/PUT | `/api/class-colors` | Custom class colors |
| GET | `/api/validation` | Missing labels, empty labels, class balance |

## Review data

All review state is stored in `<dataset>/review/` — safe to commit, copy between machines, or delete to reset without touching original images/labels.
