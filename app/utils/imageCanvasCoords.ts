export interface ScreenDimensions {
  width: number;
  height: number;
}

export interface ImageNaturalSize {
  w: number;
  h: number;
}

/**
 * Returns a function that maps image-relative 0–100 coords to screen pixels,
 * accounting for letterboxing/pillarboxing when the image aspect ratio differs
 * from the screen. Coords outside the image area are clamped to the screen edge.
 *
 * When imageNaturalSize is null (no image active), falls back to a straight
 * linear mapping across the full screen.
 */
export function makeImageCoordTransform(
  screen: ScreenDimensions,
  imageNaturalSize: ImageNaturalSize | null,
): (x: number, y: number) => { x: number; y: number } {
  if (!imageNaturalSize) {
    return (x, y) => ({
      x: (x / 100) * screen.width,
      y: (y / 100) * screen.height,
    });
  }

  const scale = Math.min(screen.width / imageNaturalSize.w, screen.height / imageNaturalSize.h);
  const dispW = imageNaturalSize.w * scale;
  const dispH = imageNaturalSize.h * scale;
  const offX = (screen.width - dispW) / 2;
  const offY = (screen.height - dispH) / 2;

  return (x, y) => ({
    x: Math.max(0, Math.min(screen.width, offX + (x / 100) * dispW)),
    y: Math.max(0, Math.min(screen.height, offY + (y / 100) * dispH)),
  });
}
