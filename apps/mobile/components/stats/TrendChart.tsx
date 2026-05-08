/**
 * TrendChart — pure-SVG bar / line chart for the mobile stats screen.
 *
 * Built on `react-native-svg` (already a dependency for icons /
 * QR code) so we add zero new native modules — works in both
 * Expo Go and the dev-client without any rebuild.
 *
 * Behaviour matches the web TrendChart:
 *   - 7-day view → grouped bars (each day is a discrete unit)
 *   - 30 / 90 / 12m → smoothed area line (the trend dominates)
 *
 * Tooltips are intentionally not implemented in v1 — long-press
 * + pan would need a gesture handler and v1's job is parity with
 * what the web shows. Easy to add later if useful.
 */

import React from 'react';
import { LayoutChangeEvent, View, StyleSheet } from 'react-native';
import Svg, {
  Defs,
  LinearGradient,
  Path,
  Rect,
  Stop,
} from 'react-native-svg';
import { Card, Text } from '../../components';
import { useTheme } from '../../theme';
import type { TrendPoint } from '@booking-app/shared';

export type ChartType = 'bar' | 'line';

interface Props {
  data: TrendPoint[];
  title: string;
  subtitle?: string;
  /** Which TrendPoint field to plot. */
  valueKey: 'revenue' | 'bookingsCount' | 'pageViews';
  chartType: ChartType;
  /** Y-axis tick formatter — eg `5 €` / `1k`. */
  formatYAxis: (v: number) => string;
}

const CHART_HEIGHT = 160;
const PADDING_TOP = 12;
const PADDING_BOTTOM = 24; // X-axis labels
const PADDING_LEFT = 36;   // Y-axis labels
const PADDING_RIGHT = 8;

export function TrendChart({
  data,
  title,
  subtitle,
  valueKey,
  chartType,
  formatYAxis,
}: Props) {
  const { colors, spacing } = useTheme();
  const [width, setWidth] = React.useState(0);

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w !== width) setWidth(w);
  };

  const values = data.map((p) => readValue(p, valueKey));
  const max = Math.max(...values, 1);
  const hasData = values.some((v) => v > 0);

  const innerW = Math.max(0, width - PADDING_LEFT - PADDING_RIGHT);
  const innerH = CHART_HEIGHT - PADDING_TOP - PADDING_BOTTOM;

  const xForIndex = (i: number) => {
    if (data.length <= 1) return PADDING_LEFT + innerW / 2;
    const step = innerW / (data.length - 1);
    return PADDING_LEFT + step * i;
  };
  const yForValue = (v: number) => PADDING_TOP + innerH - (v / max) * innerH;

  // Y-axis labels at 0, 50%, 100% of max.
  const yTicks = [0, max * 0.5, max];

  return (
    <Card padding="lg" shadow="sm" style={{ marginBottom: spacing.xl }}>
      <View style={{ marginBottom: spacing.sm }}>
        <Text variant="h3">{title}</Text>
        {subtitle && (
          <Text variant="caption" color="textMuted" style={{ marginTop: 2 }}>
            {subtitle}
          </Text>
        )}
      </View>

      <View onLayout={onLayout} style={{ height: CHART_HEIGHT }}>
        {!hasData ? (
          <View style={s.empty}>
            <Text variant="caption" color="textMuted">
              Aucune donnée sur la période sélectionnée
            </Text>
          </View>
        ) : width > 0 ? (
          <Svg width={width} height={CHART_HEIGHT}>
            <Defs>
              <LinearGradient id={`grad-${valueKey}`} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0%" stopColor={colors.primary} stopOpacity="0.35" />
                <Stop offset="100%" stopColor={colors.primary} stopOpacity="0" />
              </LinearGradient>
            </Defs>

            {/* Y gridlines + labels */}
            {yTicks.map((tick, i) => {
              const y = yForValue(tick);
              return (
                <React.Fragment key={i}>
                  {/* Gridline */}
                  <Path
                    d={`M ${PADDING_LEFT} ${y} L ${PADDING_LEFT + innerW} ${y}`}
                    stroke={colors.border}
                    strokeWidth="1"
                    strokeDasharray="3 3"
                    opacity={0.5}
                  />
                </React.Fragment>
              );
            })}

            {chartType === 'bar' ? (
              <BarShapes
                data={values}
                xForIndex={xForIndex}
                yForValue={yForValue}
                innerW={innerW}
                innerH={innerH}
                color={colors.primary}
              />
            ) : (
              <LineShapes
                values={values}
                xForIndex={xForIndex}
                yForValue={yForValue}
                color={colors.primary}
                gradientId={`grad-${valueKey}`}
                innerH={innerH}
              />
            )}
          </Svg>
        ) : null}

        {/* Y-axis labels (overlay text — easier than computing
            bounding boxes inside SVG). Positioned absolutely. */}
        {hasData && width > 0 && yTicks.map((tick, i) => (
          <Text
            key={i}
            variant="caption"
            color="textMuted"
            style={{
              position: 'absolute',
              left: 0,
              top: yForValue(tick) - 6,
              width: PADDING_LEFT - 4,
              textAlign: 'right',
              fontSize: 10,
            }}
          >
            {formatYAxis(tick)}
          </Text>
        ))}

        {/* X-axis labels: first / middle / last so the timeline
            is anchored without crowding the axis on long periods. */}
        {hasData && width > 0 && data.length > 0 && (
          <>
            <XAxisLabel x={xForIndex(0)} text={data[0].label} align="start" />
            {data.length > 2 && (
              <XAxisLabel
                x={xForIndex(Math.floor(data.length / 2))}
                text={data[Math.floor(data.length / 2)].label}
                align="center"
              />
            )}
            {data.length > 1 && (
              <XAxisLabel
                x={xForIndex(data.length - 1)}
                text={data[data.length - 1].label}
                align="end"
              />
            )}
          </>
        )}
      </View>
    </Card>
  );
}

// ────────────────────────────────────────────────────────────────
// Sub-components
// ────────────────────────────────────────────────────────────────

function BarShapes({
  data,
  xForIndex,
  yForValue,
  innerW,
  innerH,
  color,
}: {
  data: number[];
  xForIndex: (i: number) => number;
  yForValue: (v: number) => number;
  innerW: number;
  innerH: number;
  color: string;
}) {
  // Reserve a small gap between bars so they don't touch.
  const slot = data.length > 0 ? innerW / data.length : 0;
  const barW = Math.max(2, slot * 0.7);
  const baselineY = yForValue(0);
  return (
    <>
      {data.map((v, i) => {
        const cx = xForIndex(i);
        const y = yForValue(v);
        const h = Math.max(0, baselineY - y);
        return (
          <Rect
            key={i}
            x={cx - barW / 2}
            y={y}
            width={barW}
            height={h}
            fill={color}
            rx={3}
            ry={3}
          />
        );
      })}
      {/* Suppress unused-var lint */}
      {innerH ? null : null}
    </>
  );
}

function LineShapes({
  values,
  xForIndex,
  yForValue,
  color,
  gradientId,
  innerH,
}: {
  values: number[];
  xForIndex: (i: number) => number;
  yForValue: (v: number) => number;
  color: string;
  gradientId: string;
  innerH: number;
}) {
  if (values.length === 0) return null;
  // Build a smoothed Catmull-Rom path. Approximation via
  // adjacent-point averaging for the control points.
  const points = values.map((v, i) => ({ x: xForIndex(i), y: yForValue(v) }));
  const lineD = smoothPath(points);
  // Closed area: same path + return down to baseline + close.
  const areaD =
    lineD +
    ` L ${points[points.length - 1].x} ${yForValue(0)}` +
    ` L ${points[0].x} ${yForValue(0)} Z`;
  return (
    <>
      <Path d={areaD} fill={`url(#${gradientId})`} />
      <Path d={lineD} stroke={color} strokeWidth="2" fill="none" strokeLinejoin="round" strokeLinecap="round" />
      {/* Suppress unused-var lint */}
      {innerH ? null : null}
    </>
  );
}

function XAxisLabel({
  x,
  text,
  align,
}: {
  x: number;
  text: string;
  align: 'start' | 'center' | 'end';
}) {
  // 60px wide label box centered on `x` (with edge clamping).
  const W = 60;
  const left = align === 'start' ? x - 4 : align === 'end' ? x - W + 4 : x - W / 2;
  return (
    <Text
      variant="caption"
      color="textMuted"
      style={{
        position: 'absolute',
        left,
        bottom: 0,
        width: W,
        textAlign: align === 'start' ? 'left' : align === 'end' ? 'right' : 'center',
        fontSize: 10,
      }}
    >
      {text}
    </Text>
  );
}

// ────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────

function readValue(
  p: TrendPoint,
  key: 'revenue' | 'bookingsCount' | 'pageViews',
): number {
  if (key === 'revenue') return p.revenue;
  if (key === 'bookingsCount') return p.bookingsCount;
  return p.pageViews;
}

/**
 * Catmull-Rom-ish smoothed path. Each segment uses control points
 * derived from neighbouring slopes — produces a soft curve
 * without overshoot for monotone-ish data. Falls back to a
 * straight line when there are <3 points.
 */
function smoothPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
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

const s = StyleSheet.create({
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
