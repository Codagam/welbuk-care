export type PickerAnchor = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const PANEL_WIDTH = 560;
const MIN_WIDTH = 420;
/** Fits the five recent medicines with the search and footer, without scrolling. */
const PANEL_HEIGHT = 460;
const GUTTER = 16;
const GAP = 4;
const TOP_SAFE = 40;

/**
 * Where the medicine list sits: directly under the box that opened it, moved up
 * only as far as it must to stay on screen and above the keyboard. The height is
 * fixed so the list does not jump about as search results change.
 */
export function placePicker(
  anchor: PickerAnchor,
  screen: { width: number; height: number },
  keyboardHeight: number
): { left: number; top: number; width: number; height: number } {
  const width = Math.min(
    PANEL_WIDTH,
    Math.max(anchor.width, MIN_WIDTH),
    screen.width - GUTTER * 2
  );
  const left = Math.max(
    GUTTER,
    Math.min(anchor.x, screen.width - width - GUTTER)
  );
  const bottomLimit = screen.height - keyboardHeight - GUTTER;
  const height = Math.min(PANEL_HEIGHT, bottomLimit - TOP_SAFE);
  const top = Math.max(
    TOP_SAFE,
    Math.min(anchor.y + anchor.height + GAP, bottomLimit - height)
  );
  return { left, top, width, height };
}
