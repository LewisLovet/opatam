import React from 'react';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

/**
 * Sparkline — minimal trend line for the dashboard's stat cards.
 *
 * No axes, no tooltips, no labels — just the curve + a soft
 * gradient fill below it. Designed to drop into a corner of a
 * card and convey the trend at a glance. Re-uses the same
 * Catmull-Rom smoothing as the full TrendChart so the visual
 * feels consistent across the app.
 */
interface Props {
  /** Numerical series — at least 2 points to draw anything useful. */
  data: number[];
  width: number;
  height: number;
  color: string;
  /** When true, suppress the gradient under the line for a cleaner look. */
  noFill?: boolean;
  /** Stroke width of the line. Defaults to 1.5px for a 30-point sparkline. */
  strokeWidth?: number;
}

export function Sparkline({
  data,
  width,
  height,
  color,
  noFill = false,
  strokeWidth = 1.5,
}: Props) {
  if (data.length < 2 || width <= 0 || height <= 0) return null;

  const max = Math.max(...data, 1);
  // Step in X — first point at 0, last at width.
  const stepX = width / (data.length - 1);
  // 2px breathing room top/bottom so the stroke isn't clipped.
  const usableH = height - 4;
  const baseY = height - 2;
  const points = data.map((v, i) => ({
    x: i * stepX,
    y: 2 + (1 - v / max) * usableH,
  }));

  const lineD = smoothPath(points);
  const areaD =
    lineD +
    ` L ${points[points.length - 1].x} ${baseY}` +
    ` L ${points[0].x} ${baseY} Z`;

  // Use a unique gradient id per render so multiple sparklines on
  // the same screen don't share fills.
  const gradId = React.useId();

  return (
    <Svg width={width} height={height}>
      {!noFill && (
        <Defs>
          <LinearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={color} stopOpacity="0.28" />
            <Stop offset="100%" stopColor={color} stopOpacity="0" />
          </LinearGradient>
        </Defs>
      )}
      {!noFill && <Path d={areaD} fill={`url(#${gradId})`} />}
      <Path
        d={lineD}
        stroke={color}
        strokeWidth={strokeWidth}
        fill="none"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </Svg>
  );
}

function smoothPath(points: { x: number; y: number }[]): string {
  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  }
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${p2.x} ${p2.y}`;
  }
  return d;
}
