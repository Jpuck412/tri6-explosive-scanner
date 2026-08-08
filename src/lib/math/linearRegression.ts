export interface XY {
  x: number;
  y: number;
}

export interface Regression {
  slope: number;
  intercept: number;
  r2: number;
}

export function linearRegression(points: XY[]): Regression {
  if (points.length < 2) return { slope: 0, intercept: points[0]?.y ?? 0, r2: 0 };

  const n = points.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;

  for (const point of points) {
    sumX += point.x;
    sumY += point.y;
    sumXY += point.x * point.y;
    sumXX += point.x * point.x;
  }

  const denominator = n * sumXX - sumX * sumX;
  const slope = Math.abs(denominator) < Number.EPSILON
    ? 0
    : (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;
  const meanY = sumY / n;

  let ssRes = 0;
  let ssTot = 0;
  for (const point of points) {
    const predicted = slope * point.x + intercept;
    ssRes += (point.y - predicted) ** 2;
    ssTot += (point.y - meanY) ** 2;
  }

  const r2 = ssTot < Number.EPSILON ? 1 : Math.max(0, Math.min(1, 1 - ssRes / ssTot));
  return { slope, intercept, r2 };
}

export function lineValue(slope: number, intercept: number, x: number): number {
  return slope * x + intercept;
}
