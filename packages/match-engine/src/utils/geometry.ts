import type { Coordinate2D, Coordinate3D } from "../types";

export function distance(a: Coordinate2D, b: Coordinate2D): number {
  return Math.sqrt(distanceSquared(a, b));
}

export function distanceSquared(a: Coordinate2D, b: Coordinate2D): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  return dx * dx + dy * dy;
}

export function moveTowards(
  from: Coordinate2D,
  to: Coordinate2D,
  maxDistance: number
): Coordinate2D {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const length = Math.sqrt(dx * dx + dy * dy);

  if (length <= maxDistance || length === 0) {
    return [to[0], to[1]];
  }

  const ratio = maxDistance / length;
  return [from[0] + dx * ratio, from[1] + dy * ratio];
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function clamp2D(point: Coordinate2D, width: number, length: number): Coordinate2D {
  return [clamp(point[0], 0, width), clamp(point[1], 0, length)];
}

export function to2D(point: Coordinate3D): Coordinate2D {
  return [point[0], point[1]];
}
