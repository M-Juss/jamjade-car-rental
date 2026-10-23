<?php

namespace App\Services;

use App\Models\BookingGeofence;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;

class GeofenceGeometryService
{
    public function __construct(private readonly CircularGeofenceService $circles) {}

    /** @param array<string, mixed> $definition */
    public function assertValid(array $definition): void
    {
        $geometryType = $definition['geometry_type'] ?? null;
        if ($geometryType === 'circle') {
            Validator::make($definition, [
                'center_latitude' => ['required', 'numeric', 'between:-90,90'],
                'center_longitude' => ['required', 'numeric', 'between:-180,180'],
                'radius_meters' => ['required', 'numeric', 'gt:0', 'max:100000'],
            ])->validate();

            return;
        }
        if ($geometryType !== 'polygon') {
            throw ValidationException::withMessages(['geometry_type' => ['Select a circle or polygon boundary.']]);
        }

        $values = Validator::make($definition, [
            'polygon_coordinates' => ['required', 'array', 'min:3'],
            'polygon_coordinates.*.latitude' => ['required', 'numeric', 'between:-90,90'],
            'polygon_coordinates.*.longitude' => ['required', 'numeric', 'between:-180,180'],
        ])->validate();
        $points = $values['polygon_coordinates'];
        if (count($points) > 3 && $this->samePoint($points[0], $points[count($points) - 1])) {
            array_pop($points);
        }
        if (count($points) < 3) {
            throw ValidationException::withMessages(['polygon_coordinates' => ['A polygon needs at least 3 unique boundary points.']]);
        }

        foreach ($points as $index => $point) {
            if ($this->samePoint($point, $points[($index + 1) % count($points)])) {
                throw ValidationException::withMessages(['polygon_coordinates' => ['Adjacent polygon points must be different.']]);
            }
        }

        $count = count($points);
        for ($first = 0; $first < $count; $first++) {
            $firstNext = ($first + 1) % $count;
            for ($second = $first + 1; $second < $count; $second++) {
                $secondNext = ($second + 1) % $count;
                if ($first === $second || $firstNext === $second || $secondNext === $first) {
                    continue;
                }
                if ($this->segmentsIntersect($points[$first], $points[$firstNext], $points[$second], $points[$secondNext])) {
                    throw ValidationException::withMessages(['polygon_coordinates' => ['Polygon edges must not cross each other.']]);
                }
            }
        }

        $area = 0.0;
        foreach ($points as $index => $point) {
            $next = $points[($index + 1) % $count];
            $area += ((float) $point['longitude'] * (float) $next['latitude'])
                - ((float) $next['longitude'] * (float) $point['latitude']);
        }
        if (abs($area) < 1.0e-12) {
            throw ValidationException::withMessages(['polygon_coordinates' => ['Polygon points must enclose an area.']]);
        }
    }

    /** @return array{inside: bool, geometry_type: string, distance_meters: ?float, radius_meters: ?float, boundary_distance_meters: float} */
    public function evaluate(BookingGeofence $geofence, float $latitude, float $longitude): array
    {
        if ($geofence->geometry_type === 'circle') {
            $circle = $this->circles->evaluate($geofence, $latitude, $longitude);

            return [
                ...$circle,
                'boundary_distance_meters' => abs($circle['distance_meters'] - $circle['radius_meters']),
                'geometry_type' => 'circle',
            ];
        }

        $points = $geofence->polygon_coordinates ?? [];
        if (count($points) > 3 && $this->samePoint($points[0], $points[count($points) - 1])) {
            array_pop($points);
        }
        $inside = false;
        $boundaryDistance = INF;
        $count = count($points);
        for ($index = 0, $previous = $count - 1; $index < $count; $previous = $index++) {
            $a = ['longitude' => (float) $points[$previous]['longitude'], 'latitude' => (float) $points[$previous]['latitude']];
            $b = ['longitude' => (float) $points[$index]['longitude'], 'latitude' => (float) $points[$index]['latitude']];
            $point = ['longitude' => $longitude, 'latitude' => $latitude];
            $boundaryDistance = min($boundaryDistance, $this->distanceToSegment($point, $a, $b));
            if ($this->pointOnSegment($point, $a, $b)) {
                $inside = true;
                break;
            }
            $crosses = (($a['latitude'] > $latitude) !== ($b['latitude'] > $latitude))
                && ($longitude < ($b['longitude'] - $a['longitude']) * ($latitude - $a['latitude'])
                    / (($b['latitude'] - $a['latitude']) ?: 1.0e-15) + $a['longitude']);
            if ($crosses) {
                $inside = ! $inside;
            }
        }

        return [
            'inside' => $inside,
            'geometry_type' => 'polygon',
            'distance_meters' => null,
            'radius_meters' => null,
            'boundary_distance_meters' => $boundaryDistance,
        ];
    }

    private function distanceToSegment(array $point, array $a, array $b): float
    {
        // Local tangent-plane distance is adequate for the configured GPS uncertainty band.
        $scale = 6371008.8 * M_PI / 180;
        $longitudeScale = $scale * cos(deg2rad($point['latitude']));
        $ax = ($a['longitude'] - $point['longitude']) * $longitudeScale;
        $ay = ($a['latitude'] - $point['latitude']) * $scale;
        $bx = ($b['longitude'] - $point['longitude']) * $longitudeScale;
        $by = ($b['latitude'] - $point['latitude']) * $scale;
        $dx = $bx - $ax;
        $dy = $by - $ay;
        $length = $dx * $dx + $dy * $dy;
        $t = $length > 0 ? max(0, min(1, -($ax * $dx + $ay * $dy) / $length)) : 0;

        return hypot($ax + $t * $dx, $ay + $t * $dy);
    }

    private function samePoint(array $first, array $second): bool
    {
        return (float) $first['latitude'] === (float) $second['latitude']
            && (float) $first['longitude'] === (float) $second['longitude'];
    }

    private function pointOnSegment(array $point, array $a, array $b): bool
    {
        $cross = ($point['latitude'] - $a['latitude']) * ($b['longitude'] - $a['longitude'])
            - ($point['longitude'] - $a['longitude']) * ($b['latitude'] - $a['latitude']);
        if (abs($cross) > 1.0e-10) {
            return false;
        }

        return $point['longitude'] >= min($a['longitude'], $b['longitude']) - 1.0e-10
            && $point['longitude'] <= max($a['longitude'], $b['longitude']) + 1.0e-10
            && $point['latitude'] >= min($a['latitude'], $b['latitude']) - 1.0e-10
            && $point['latitude'] <= max($a['latitude'], $b['latitude']) + 1.0e-10;
    }

    private function segmentsIntersect(array $a, array $b, array $c, array $d): bool
    {
        $orient = fn (array $p, array $q, array $r): float => ((float) $q['longitude'] - (float) $p['longitude']) * ((float) $r['latitude'] - (float) $p['latitude'])
            - ((float) $q['latitude'] - (float) $p['latitude']) * ((float) $r['longitude'] - (float) $p['longitude']);
        $o1 = $orient($a, $b, $c);
        $o2 = $orient($a, $b, $d);
        $o3 = $orient($c, $d, $a);
        $o4 = $orient($c, $d, $b);

        if ((($o1 > 0 && $o2 < 0) || ($o1 < 0 && $o2 > 0))
            && (($o3 > 0 && $o4 < 0) || ($o3 < 0 && $o4 > 0))) {
            return true;
        }

        return (abs($o1) < 1.0e-12 && $this->pointOnSegment($c, $a, $b))
            || (abs($o2) < 1.0e-12 && $this->pointOnSegment($d, $a, $b))
            || (abs($o3) < 1.0e-12 && $this->pointOnSegment($a, $c, $d))
            || (abs($o4) < 1.0e-12 && $this->pointOnSegment($b, $c, $d));
    }
}
