import * as turf from '@turf/turf';

export interface OffRouteStatus {
  isOffRoute: boolean;
  distanceToRouteMeters: number;
  nearestPoint: [number, number];
  bearingToRoute: number;
  progressPercent: number;
  distanceRemainingMeters: number;
}

/**
 * Calculates total path length in meters using Turf.js
 */
export function calculatePathLengthMeters(path: [number, number][]): number {
  if (!path || path.length < 2) return 0;
  // Turf expects [lng, lat]
  const lineCoords = path.map(([lat, lng]) => [lng, lat]);
  const line = turf.lineString(lineCoords);
  const lengthKm = turf.length(line, { units: 'kilometers' });
  return Math.round(lengthKm * 1000);
}

/**
 * Checks visitor position relative to the route polyline.
 * @param currentPos [lat, lng]
 * @param path [[lat, lng], ...]
 * @param toleranceMeters Default 25 meters
 */
export function evaluateVisitorPosition(
  currentPos: [number, number],
  path: [number, number][],
  toleranceMeters: number = 25
): OffRouteStatus {
  if (!path || path.length < 2) {
    return {
      isOffRoute: false,
      distanceToRouteMeters: 0,
      nearestPoint: currentPos,
      bearingToRoute: 0,
      progressPercent: 0,
      distanceRemainingMeters: 0
    };
  }

  // Convert to [lng, lat] for turf
  const lineCoords = path.map(([lat, lng]) => [lng, lat]);
  const line = turf.lineString(lineCoords);
  const pt = turf.point([currentPos[1], currentPos[0]]);

  // Distance from point to line in kilometers
  const distanceKm = turf.pointToLineDistance(pt, line, { units: 'kilometers' });
  const distanceMeters = Math.round(distanceKm * 1000);

  // Snapped nearest point on the line
  const snapped = turf.nearestPointOnLine(line, pt);
  const nearestLat = snapped.geometry.coordinates[1];
  const nearestLng = snapped.geometry.coordinates[0];

  // Calculate bearing from current position toward nearest line point
  const bearing = turf.bearing(pt, snapped);

  // Progress along the route: find distance from start to snapped point
  const totalLengthKm = turf.length(line, { units: 'kilometers' });
  const startPt = turf.point(lineCoords[0]);
  
  // Calculate distance traveled along the line to snapped point
  // Slice line from start to snapped point
  let progressRatio = 0;
  try {
    const sliced = turf.lineSlice(startPt, snapped, line);
    const slicedLengthKm = turf.length(sliced, { units: 'kilometers' });
    progressRatio = totalLengthKm > 0 ? Math.min(1, slicedLengthKm / totalLengthKm) : 0;
  } catch {
    progressRatio = 0;
  }

  const remainingMeters = Math.max(0, Math.round((1 - progressRatio) * (totalLengthKm * 1000)));

  return {
    isOffRoute: distanceMeters > toleranceMeters,
    distanceToRouteMeters: distanceMeters,
    nearestPoint: [nearestLat, nearestLng],
    bearingToRoute: Math.round(bearing),
    progressPercent: Math.round(progressRatio * 100),
    distanceRemainingMeters: remainingMeters
  };
}

/**
 * Calculates direct distance between two coordinates in meters
 */
export function distanceBetweenCoordsMeters(
  coord1: [number, number],
  coord2: [number, number]
): number {
  const from = turf.point([coord1[1], coord1[0]]);
  const to = turf.point([coord2[1], coord2[0]]);
  const distKm = turf.distance(from, to, { units: 'kilometers' });
  return Math.round(distKm * 1000);
}

/**
 * Format meters to human readable string
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(1)} km`;
}

/**
 * Format walking time in minutes
 */
export function formatWalkTime(meters: number): string {
  // Average urban walking speed ~ 4.5 km/h = 75 meters/min
  const minutes = Math.max(1, Math.round(meters / 75));
  return `${minutes} min walk`;
}
