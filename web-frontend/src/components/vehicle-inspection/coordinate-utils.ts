export const VEHICLE_VIEWBOX_WIDTH = 1000;
export const VEHICLE_VIEWBOX_HEIGHT = 600;
export const MIN_VEHICLE_ZOOM = 1;
export const MAX_VEHICLE_ZOOM = 4;

export function clampVehicleZoom(value: number) {
  return Math.min(MAX_VEHICLE_ZOOM, Math.max(MIN_VEHICLE_ZOOM, value));
}

export function toPercentage(value: number, dimension: number) {
  return Math.min(100, Math.max(0, (value / dimension) * 100));
}

export function percentageToCoordinate(value: number, dimension: number) {
  return (value / 100) * dimension;
}

export function clientPointInSvg(
  element: SVGGraphicsElement,
  clientX: number,
  clientY: number,
) {
  const matrix = element.getScreenCTM();
  const svg = element.ownerSVGElement;

  if (!matrix || !svg) return null;

  const point = svg.createSVGPoint();
  point.x = clientX;
  point.y = clientY;

  return point.matrixTransform(matrix.inverse());
}
