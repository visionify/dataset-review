/** Distinct colors for classes; focused class is always red when provided. */
const PALETTE = [
  "#e6194b", "#3cb44b", "#4363d8", "#f58231", "#911eb4",
  "#42d4f4", "#f032e6", "#bfef45", "#fabed4", "#469990",
  "#dcbeff", "#9a6324", "#fffac8", "#800000", "#aaffc3", "#808000",
];

export function getClassColor(classId: number, focusedClassId: number | null): string {
  if (focusedClassId !== null && classId === focusedClassId) return "#e00";
  return PALETTE[classId % PALETTE.length] ?? "#888";
}

export function getClassColorMuted(classId: number, focusedClassId: number | null): string {
  if (focusedClassId !== null && classId === focusedClassId) return "#e00";
  const base = PALETTE[classId % PALETTE.length] ?? "#888";
  return base + "99";
}
