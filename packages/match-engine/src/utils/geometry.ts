export function distSq(p1: [number, number], p2: [number, number]): number {
  const dx = p1[0] - p2[0];
  const dy = p1[1] - p2[1];
  return dx * dx + dy * dy;
}

export function distSq3D(p1: [number, number, number], p2: [number, number, number]): number {
  const dx = p1[0] - p2[0];
  const dy = p1[1] - p2[1];
  const dz = p1[2] - p2[2];
  return dx * dx + dy * dy + dz * dz;
}

export function moveTowards(current: [number, number], target: [number, number], maxStep: number): [number, number] {
  const dx = target[0] - current[0];
  const dy = target[1] - current[1];
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist <= maxStep) {
    return [target[0], target[1]];
  }

  const ratio = maxStep / dist;
  return [current[0] + dx * ratio, current[1] + dy * ratio];
}
