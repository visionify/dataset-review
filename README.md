# YOLO Dataset Review

A local Vite + React app to inspect and review YOLO-format datasets before training. Runs on your desktop with a small Node backend for file access.

## Features

- **Dataset path**: Set the absolute path to your YOLO dataset (with `data.yaml`, `images/`, `labels/`).
- **Classes**: List all classes and sample images per class from your labels.
- **Class detail**: View all images that contain a given class, in grid or list, with pagination.
- **All images**: Browse all dataset images in a grid with pagination.
- **Image detail**: Open a single image with bounding-box overlay, prev/next pagination, edit and save annotations (YOLO format), and tags (day/night, camera, client).
- **Validation**: Pre-training checks: images without label files, empty label files, class distribution.
- **Review folder**: Tags and metadata are stored under `dataset/review/` so you can version or share them separately.

## Quick start

```bash
npm install
npm run dev
```

- Open http://localhost:5173
- Go to **Dataset path**, enter the absolute path to your YOLO dataset, then **Save path**.
- Use **Classes** to browse by class, **All images** for a full grid, and **Validation** for checks.

## Dataset layout

Your dataset should look like:

```
/path/to/dataset/
├── data.yaml          # classes and train/val paths
├── images/
│   ├── train/
│   └── val/
├── labels/
│   ├── train/
│   └── val/
└── review/            # created by this app
    ├── metadata.json  # last-saved info, optional stats
    └── tags/          # one JSON per image (by base name)
        ├── image1.json
        └── ...
```

## Review folder (`dataset/review/`)

- **`tags/<image_base>.json`**: Per-image tags, e.g. `{ "day": true, "night": false, "camera": "cam1", "client": "acme" }`. Same base name as the image (no extension).
- **`metadata.json`**: App metadata (e.g. last saved annotation, timestamps). You can extend this for your own notes.

You can keep `review/` in git or copy it between machines without touching the original images/labels if needed.

## Environment

- **`DATASET_PATH`**: Optional default dataset path. Overridden by the path saved in the app (stored in project `dataset-path.json`).

## Scripts

- `npm run dev` – start API server and Vite dev server
- `npm run dev:vite` – Vite only (no API)
- `npm run dev:server` – API only (port 3456)
- `npm run build` – build frontend
- `npm run preview` – preview production build
