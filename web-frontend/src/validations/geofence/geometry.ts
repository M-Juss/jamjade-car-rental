type Point = { latitude: number; longitude: number };

const same = (a: Point, b: Point) => a.latitude === b.latitude && a.longitude === b.longitude;
const orientation = (a: Point, b: Point, c: Point) =>
  (b.longitude - a.longitude) * (c.latitude - a.latitude) - (b.latitude - a.latitude) * (c.longitude - a.longitude);

function onSegment(point: Point, a: Point, b: Point) {
  return Math.abs(orientation(a, b, point)) <= 1e-10
    && point.longitude >= Math.min(a.longitude, b.longitude) - 1e-10
    && point.longitude <= Math.max(a.longitude, b.longitude) + 1e-10
    && point.latitude >= Math.min(a.latitude, b.latitude) - 1e-10
    && point.latitude <= Math.max(a.latitude, b.latitude) + 1e-10;
}

function intersects(a: Point, b: Point, c: Point, d: Point) {
  const o1 = orientation(a, b, c), o2 = orientation(a, b, d), o3 = orientation(c, d, a), o4 = orientation(c, d, b);
  return (((o1 > 0 && o2 < 0) || (o1 < 0 && o2 > 0)) && ((o3 > 0 && o4 < 0) || (o3 < 0 && o4 > 0)))
    || (Math.abs(o1) < 1e-12 && onSegment(c, a, b)) || (Math.abs(o2) < 1e-12 && onSegment(d, a, b))
    || (Math.abs(o3) < 1e-12 && onSegment(a, c, d)) || (Math.abs(o4) < 1e-12 && onSegment(b, c, d));
}

// Mirrors GeofenceGeometryService's geometry rules, after field validation.
export function polygonValidationError(input: Point[]): string | undefined {
  const points = input.length > 3 && same(input[0], input[input.length - 1]) ? input.slice(0, -1) : input;
  if (points.length < 3 || points.length > 100) return "A polygon needs 3 to 100 unique boundary points.";
  const count = points.length;
  if (points.some((point, index) => same(point, points[(index + 1) % count]))) return "Adjacent polygon points must be different.";
  for (let first = 0; first < count; first++) {
    const firstNext = (first + 1) % count;
    for (let second = first + 1; second < count; second++) {
      const secondNext = (second + 1) % count;
      if (first === second || firstNext === second || secondNext === first) continue;
      if (intersects(points[first], points[firstNext], points[second], points[secondNext])) return "Polygon edges must not cross each other.";
    }
  }
  const area = points.reduce((total, point, index) => {
    const next = points[(index + 1) % count];
    return total + point.longitude * next.latitude - next.longitude * point.latitude;
  }, 0);
  return Math.abs(area) < 1e-12 ? "Polygon points must enclose an area." : undefined;
}
