type FocusedFieldLayout = {
  fieldTop: number;
  fieldHeight: number;
  viewportTop: number;
  viewportHeight: number;
  keyboardTop?: number;
  scrollOffset: number;
  clearance: number;
};

export function getFocusedFieldScrollOffset({
  fieldTop,
  fieldHeight,
  viewportTop,
  viewportHeight,
  keyboardTop,
  scrollOffset,
  clearance,
}: FocusedFieldLayout): number | null {
  const visibleTop = viewportTop + clearance;
  const visibleBottom = Math.min(viewportTop + viewportHeight, keyboardTop ?? Infinity) - clearance;
  const visibleHeight = visibleBottom - visibleTop;

  if (visibleHeight <= 0 || fieldHeight <= 0) return null;

  // A tall multiline field cannot fit entirely. Keep its start reachable.
  if (fieldHeight > visibleHeight || fieldTop < visibleTop) {
    return Math.max(0, scrollOffset + fieldTop - visibleTop);
  }

  const hiddenHeight = fieldTop + fieldHeight - visibleBottom;
  return hiddenHeight > 0 ? Math.max(0, scrollOffset + hiddenHeight) : null;
}
