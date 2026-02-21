import { useState, useCallback, useRef } from "react";
import { getClassColor } from "@/classColors";
import type { BBox } from "@/types";

const HANDLE_SIZE = 8;
type ResizeHandle = "nw" | "ne" | "sw" | "se" | "n" | "s" | "e" | "w";

export interface BBoxCanvasProps {
  imageUrl: string;
  boxes: BBox[];
  classNames: Record<number, string>;
  selectedIndex: number | null;
  defaultClassId: number;
  focusedClassId?: number | null;
  classColors?: Record<number, string>;
  onSelect: (i: number | null) => void;
  onBoxesChange: (boxes: BBox[]) => void;
  /** Optional max height for gallery/smaller layouts */
  maxHeight?: string;
  /** If true, canvas and image fill all available space */
  fill?: boolean;
}

export function BBoxCanvas({
  imageUrl,
  boxes,
  classNames,
  selectedIndex,
  defaultClassId,
  focusedClassId,
  classColors,
  onSelect,
  onBoxesChange,
  maxHeight = "calc(100vh - 140px)",
  fill = false,
}: BBoxCanvasProps) {
  const focus = focusedClassId ?? null;
  const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ startX: number; startY: number; currentX: number; currentY: number } | null>(null);
  const [resize, setResize] = useState<{ index: number; handle: ResizeHandle; startBox: BBox; startX: number; startY: number } | null>(null);

  const strokeColorFor = useCallback(
    (classId: number, selected: boolean) => {
      if (selected) return "cyan";
      if (classColors && classColors[classId]) return classColors[classId];
      return getClassColor(classId, focus);
    },
    [classColors, focus]
  );

  const imgRef = useCallback((el: HTMLImageElement | null) => {
    if (!el) return;
    const update = () => {
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      if (w && h) setImgSize({ w, h });
    };
    if (el.complete) update();
    else el.addEventListener("load", update);
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("load", update);
      ro.disconnect();
    };
  }, []);

  const getNorm = (e: React.MouseEvent) => {
    const imgEl = (e.currentTarget as HTMLElement).querySelector("img");
    if (!imgEl) return null;
    const imgRect = imgEl.getBoundingClientRect();
    return {
      x: (e.clientX - imgRect.left) / imgRect.width,
      y: (e.clientY - imgRect.top) / imgRect.height,
    };
  };

  const hitHandle = (norm: { x: number; y: number }, b: BBox, imgW: number, imgH: number): ResizeHandle | null => {
    const x = (b.x - b.w / 2) * imgW;
    const y = (b.y - b.h / 2) * imgH;
    const bw = b.w * imgW;
    const bh = b.h * imgH;
    const px = norm.x * imgW;
    const py = norm.y * imgH;
    const h = Math.max(HANDLE_SIZE / 2, 6);
    const corners: [ResizeHandle, number, number][] = [
      ["nw", x, y],
      ["ne", x + bw, y],
      ["sw", x, y + bh],
      ["se", x + bw, y + bh],
      ["n", x + bw / 2, y],
      ["s", x + bw / 2, y + bh],
      ["e", x + bw, y + bh / 2],
      ["w", x, y + bh / 2],
    ];
    for (const [handle, hx, hy] of corners) {
      if (Math.abs(px - hx) <= h && Math.abs(py - hy) <= h) return handle;
    }
    return null;
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!imgSize) return;
    const norm = getNorm(e);
    if (!norm || norm.x < 0 || norm.x > 1 || norm.y < 0 || norm.y > 1) return;

    if (selectedIndex !== null && boxes[selectedIndex]) {
      const handle = hitHandle(norm, boxes[selectedIndex], imgSize.w, imgSize.h);
      if (handle) {
        e.preventDefault();
        setResize({ index: selectedIndex, handle, startBox: { ...boxes[selectedIndex] }, startX: e.clientX, startY: e.clientY });
        return;
      }
    }

    const hit = boxes.findIndex((b) => {
      const bx = b.x - b.w / 2;
      const by = b.y - b.h / 2;
      return norm.x >= bx && norm.x <= bx + b.w && norm.y >= by && norm.y <= by + b.h;
    });
    if (hit >= 0) {
      onSelect(hit);
      return;
    }
    onSelect(null);
    setDrag({ startX: norm.x, startY: norm.y, currentX: norm.x, currentY: norm.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const norm = getNorm(e);
    if (!norm) return;

    if (resize !== null && imgSize) {
      const { index, handle, startBox, startX, startY } = resize;
      const imgEl = (e.currentTarget as HTMLElement).querySelector("img");
      if (!imgEl) return;
      const imgRect = imgEl.getBoundingClientRect();
      const dx = (e.clientX - startX) / imgRect.width;
      const dy = (e.clientY - startY) / imgRect.height;
      let { x, y, w, h } = startBox;
      const xMin = x - w / 2;
      const xMax = x + w / 2;
      const yMin = y - h / 2;
      const yMax = y + h / 2;
      if (handle.includes("w")) {
        const n = Math.min(xMin + dx, xMax - 0.01);
        x = (n + xMax) / 2;
        w = xMax - n;
      }
      if (handle.includes("e")) {
        const n = Math.max(xMax + dx, xMin + 0.01);
        x = (xMin + n) / 2;
        w = n - xMin;
      }
      if (handle.includes("n")) {
        const n = Math.min(yMin + dy, yMax - 0.01);
        y = (n + yMax) / 2;
        h = yMax - n;
      }
      if (handle.includes("s")) {
        const n = Math.max(yMax + dy, yMin + 0.01);
        y = (yMin + n) / 2;
        h = n - yMin;
      }
      const next = boxes.map((b, i) => (i === index ? { ...b, x, y, w: Math.max(0.01, w), h: Math.max(0.01, h) } : b));
      onBoxesChange(next);
      return;
    }

    if (drag) {
      setDrag((d) => (d ? { ...d, currentX: Math.max(0, Math.min(1, norm.x)), currentY: Math.max(0, Math.min(1, norm.y)) } : null));
    }
  };

  const handleMouseUp = (_e: React.MouseEvent) => {
    if (resize) {
      setResize(null);
      return;
    }
    if (!drag || !imgSize) {
      setDrag(null);
      return;
    }
    const x0 = drag.startX;
    const y0 = drag.startY;
    const x1 = drag.currentX;
    const y1 = drag.currentY;
    const xMin = Math.max(0, Math.min(x0, x1));
    const xMax = Math.min(1, Math.max(x0, x1));
    const yMin = Math.max(0, Math.min(y0, y1));
    const yMax = Math.min(1, Math.max(y0, y1));
    const w = xMax - xMin;
    const h = yMax - yMin;
    if (w >= 0.01 && h >= 0.01) {
      const newBox: BBox = {
        classId: defaultClassId,
        x: xMin + w / 2,
        y: yMin + h / 2,
        w,
        h,
      };
      onBoxesChange([...boxes, newBox]);
      onSelect(boxes.length);
    }
    setDrag(null);
  };

  const handleMouseLeave = () => {
    setDrag(null);
    setResize(null);
  };

  const containerStyle: React.CSSProperties = fill
    ? { position: "relative", width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", minHeight: 0 }
    : { position: "relative", display: "inline-block", maxWidth: "100%", maxHeight: "100%" };

  const imgStyle: React.CSSProperties = fill
    ? { maxWidth: "100%", maxHeight: "100%", objectFit: "contain", display: "block", userSelect: "none", pointerEvents: "none" }
    : { maxWidth: "100%", maxHeight, objectFit: "contain", display: "block", userSelect: "none", pointerEvents: "none" };

  return (
    <div
      ref={containerRef}
      style={containerStyle}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
    >
      <img ref={imgRef} src={imageUrl} alt="" style={imgStyle} draggable={false} />
      {imgSize && (
        <svg
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
          viewBox={`0 0 ${imgSize.w} ${imgSize.h}`}
        >
          {boxes.map((b, i) => {
            const x = (b.x - b.w / 2) * imgSize.w;
            const y = (b.y - b.h / 2) * imgSize.h;
            const bw = b.w * imgSize.w;
            const bh = b.h * imgSize.h;
            const selected = i === selectedIndex;
            const color = strokeColorFor(b.classId, selected);
            const strokeColor = selected ? "cyan" : color;
            return (
              <g key={i}>
                <rect x={x} y={y} width={bw} height={bh} fill="none" stroke={strokeColor} strokeWidth={selected ? 3 : 2} />
                <text x={x} y={y - 4} fill={strokeColor} fontSize={12}>
                  {classNames[b.classId] ?? b.classId}
                </text>
                {selected && (
                  <>
                    {(["nw", "ne", "sw", "se", "n", "s", "e", "w"] as const).map((handle) => {
                      const hx = handle.includes("e") ? x + bw : handle.includes("w") ? x : x + bw / 2;
                      const hy = handle.includes("s") ? y + bh : handle.includes("n") ? y : y + bh / 2;
                      return (
                        <circle
                          key={handle}
                          cx={hx}
                          cy={hy}
                          r={HANDLE_SIZE / 2}
                          fill="white"
                          stroke="cyan"
                          strokeWidth={2}
                        />
                      );
                    })}
                  </>
                )}
              </g>
            );
          })}
          {drag && (
            <rect
              x={Math.min(drag.startX, drag.currentX) * imgSize.w}
              y={Math.min(drag.startY, drag.currentY) * imgSize.h}
              width={Math.abs(drag.currentX - drag.startX) * imgSize.w}
              height={Math.abs(drag.currentY - drag.startY) * imgSize.h}
              fill="none"
              stroke="cyan"
              strokeWidth={2}
              strokeDasharray="4 2"
            />
          )}
        </svg>
      )}
    </div>
  );
}
