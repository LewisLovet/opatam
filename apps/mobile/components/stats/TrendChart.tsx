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
 * Tooltips: tap (or pan) anywhere on the chart to surface the
 * exact value for the closest bucket. The tooltip pops above the
 * touch point, stays visible until the user touches outside or
 * the data changes (period switch / refresh). A vertical
 * highlight bar marks the active bucket; the line variant also
 * shows an emphasized dot at the active value.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  GestureResponderEvent,
  LayoutChangeEvent,
  PanResponder,
  StyleSheet,
  View,
} from 'react-native';
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Line,
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
  /**
   * Tooltip value formatter — typically more precise than the
   * Y-axis (eg `1 234,50 €` vs the axis's `1k€`). Defaults to
   * the same formatter as the Y-axis.
   */
  formatTooltipValue?: (v: number) => string;
}

const CHART_HEIGHT = 160;
const PADDING_TOP = 16;
const PADDING_BOTTOM = 24; // X-axis labels
const PADDING_LEFT = 36;   // Y-axis labels
const PADDING_RIGHT = 8;

const TOOLTIP_HEIGHT = 48;
const TOOLTIP_MIN_W = 80;

export function TrendChart({
  data,
  title,
  subtitle,
  valueKey,
  chartType,
  formatYAxis,
  formatTooltipValue,
}: Props) {
  const { t } = useTranslation();
  const { colors, spacing, radius } = useTheme();
  const [width, setWidth] = React.useState(0);
  const [activeIndex, setActiveIndex] = React.useState<number | null>(null);

  // Reset the active tooltip whenever the underlying data changes
  // (period switch, refresh) — the cached index would point to a
  // different bucket than what the user originally tapped.
  React.useEffect(() => {
    setActiveIndex(null);
  }, [data]);

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w !== width) setWidth(w);
  };

  const values = data.map((p) => readValue(p, valueKey));
  const max = Math.max(...values, 1);
  const hasData = values.some((v) => v > 0);

  const innerW = Math.max(0, width - PADDING_LEFT - PADDING_RIGHT);
  const innerH = CHART_HEIGHT - PADDING_TOP - PADDING_BOTTOM;

  // Positioning differs between bar and line modes:
  //  - LINE: points sit AT the edges (first at PADDING_LEFT, last at
  //    PADDING_LEFT + innerW) so the curve spans the full width.
  //  - BAR: bars sit in EQUAL SLOTS across innerW; each bar is centered
  //    at slot/2 increments. With 7 bars the first center is offset by
  //    slot/2 from the left so the bar isn't half-cut by the chart's
  //    left edge, and the last is offset by slot/2 from the right so
  //    it doesn't overflow either. This is the fix for the "7-day
  //    chart looks bunched up against the left" issue.
  const xForIndex = React.useCallback(
    (i: number) => {
      if (data.length === 0) return PADDING_LEFT;
      if (chartType === 'bar') {
        const slot = innerW / data.length;
        return PADDING_LEFT + (i + 0.5) * slot;
      }
      if (data.length === 1) return PADDING_LEFT + innerW / 2;
      const step = innerW / (data.length - 1);
      return PADDING_LEFT + step * i;
    },
    [data.length, innerW, chartType],
  );
  const yForValue = React.useCallback(
    (v: number) => PADDING_TOP + innerH - (v / max) * innerH,
    [innerH, max],
  );

  // ── Touch handling — tap / pan to expose tooltips ──────────────
  // Uses the same positioning model as `xForIndex` so the tooltip
  // snaps to whatever the user is actually touching (slot-based in
  // bar mode, point-based in line mode).
  const indexFromTouch = React.useCallback(
    (locationX: number): number => {
      const xInPlot = Math.max(0, Math.min(innerW, locationX - PADDING_LEFT));
      if (data.length === 0) return 0;
      if (chartType === 'bar') {
        const slot = innerW / data.length;
        const raw = Math.floor(xInPlot / slot);
        return Math.max(0, Math.min(data.length - 1, raw));
      }
      if (data.length === 1) return 0;
      const step = innerW / (data.length - 1);
      const raw = Math.round(xInPlot / step);
      return Math.max(0, Math.min(data.length - 1, raw));
    },
    [data.length, innerW, chartType],
  );

  const panResponder = React.useMemo(
    () =>
      PanResponder.create({
        // Capture both single taps and pans without fighting the
        // ScrollView — onStartShouldSet returns true on tap so we
        // get an immediate response, but we don't claim the move
        // gesture unless the finger has moved horizontally enough
        // to be "scrubbing", letting vertical scrolls pass through.
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gesture) =>
          Math.abs(gesture.dx) > Math.abs(gesture.dy),
        onPanResponderGrant: (e: GestureResponderEvent) => {
          if (!hasData) return;
          setActiveIndex(indexFromTouch(e.nativeEvent.locationX));
        },
        onPanResponderMove: (e: GestureResponderEvent) => {
          if (!hasData) return;
          setActiveIndex(indexFromTouch(e.nativeEvent.locationX));
        },
        onPanResponderTerminationRequest: () => true,
      }),
    [hasData, indexFromTouch],
  );

  // Y-axis labels at 0, 50%, 100% of max.
  const yTicks = [0, max * 0.5, max];

  const tipFormat = formatTooltipValue ?? formatYAxis;
  const active = activeIndex !== null ? data[activeIndex] : null;
  const activeValue = active ? readValue(active, valueKey) : 0;

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

      <View
        onLayout={onLayout}
        {...panResponder.panHandlers}
        style={{ height: CHART_HEIGHT }}
      >
        {!hasData ? (
          <View style={s.empty}>
            <Text variant="caption" color="textMuted">
              {t('proStats.chart.empty')}
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

            {/* Y gridlines */}
            {yTicks.map((tick, i) => {
              const y = yForValue(tick);
              return (
                <Path
                  key={i}
                  d={`M ${PADDING_LEFT} ${y} L ${PADDING_LEFT + innerW} ${y}`}
                  stroke={colors.border}
                  strokeWidth="1"
                  strokeDasharray="3 3"
                  opacity={0.5}
                />
              );
            })}

            {chartType === 'bar' ? (
              <BarShapes
                data={values}
                xForIndex={xForIndex}
                yForValue={yForValue}
                innerW={innerW}
                color={colors.primary}
                activeIndex={activeIndex}
                activeColor={colors.primaryDark}
              />
            ) : (
              <LineShapes
                values={values}
                xForIndex={xForIndex}
                yForValue={yForValue}
                color={colors.primary}
                gradientId={`grad-${valueKey}`}
                activeIndex={activeIndex}
              />
            )}

            {/* Active vertical guide + accent — drawn on top so it
                stands out above the bars/area. */}
            {activeIndex !== null && (
              <Line
                x1={xForIndex(activeIndex)}
                x2={xForIndex(activeIndex)}
                y1={PADDING_TOP - 4}
                y2={PADDING_TOP + innerH}
                stroke={colors.primary}
                strokeWidth="1"
                strokeDasharray="2 2"
                opacity={0.5}
              />
            )}
          </Svg>
        ) : null}

        {/* Tooltip — absolute overlay so we don't need to embed
            text inside SVG (RN Text bbox is awkward there). */}
        {active && width > 0 && (
          <Tooltip
            x={xForIndex(activeIndex!)}
            y={yForValue(activeValue)}
            label={active.label}
            valueText={tipFormat(activeValue)}
            chartWidth={width}
          />
        )}

        {/* Y-axis labels (overlay text). */}
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

        {/* X-axis labels: first / middle / last (anchored). */}
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

      {/* Footnote — surfaced once the user has interacted so
          they know how to use the chart. */}
      {hasData && (
        <Text
          variant="caption"
          color="textMuted"
          style={{ marginTop: spacing.xs, fontSize: 10 }}
        >
          {activeIndex === null
            ? t('proStats.chart.tapHint')
            : t('proStats.chart.dragHint')}
        </Text>
      )}
      {/* Suppress unused-var lint */}
      {radius ? null : null}
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
  color,
  activeIndex,
  activeColor,
}: {
  data: number[];
  xForIndex: (i: number) => number;
  yForValue: (v: number) => number;
  innerW: number;
  color: string;
  activeIndex: number | null;
  activeColor: string;
}) {
  const slot = data.length > 0 ? innerW / data.length : 0;
  const barW = Math.max(2, slot * 0.7);
  const baselineY = yForValue(0);
  return (
    <>
      {data.map((v, i) => {
        const cx = xForIndex(i);
        const y = yForValue(v);
        const h = Math.max(0, baselineY - y);
        const isActive = activeIndex === i;
        return (
          <Rect
            key={i}
            x={cx - barW / 2}
            y={y}
            width={barW}
            height={h}
            fill={isActive ? activeColor : color}
            opacity={activeIndex === null || isActive ? 1 : 0.45}
            rx={3}
            ry={3}
          />
        );
      })}
    </>
  );
}

function LineShapes({
  values,
  xForIndex,
  yForValue,
  color,
  gradientId,
  activeIndex,
}: {
  values: number[];
  xForIndex: (i: number) => number;
  yForValue: (v: number) => number;
  color: string;
  gradientId: string;
  activeIndex: number | null;
}) {
  if (values.length === 0) return null;
  const points = values.map((v, i) => ({ x: xForIndex(i), y: yForValue(v) }));
  const lineD = smoothPath(points);
  const areaD =
    lineD +
    ` L ${points[points.length - 1].x} ${yForValue(0)}` +
    ` L ${points[0].x} ${yForValue(0)} Z`;
  return (
    <>
      <Path d={areaD} fill={`url(#${gradientId})`} />
      <Path
        d={lineD}
        stroke={color}
        strokeWidth="2"
        fill="none"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* Emphasized dot at the active position. */}
      {activeIndex !== null && (
        <>
          <Circle
            cx={points[activeIndex].x}
            cy={points[activeIndex].y}
            r={6}
            fill="#FFF"
            stroke={color}
            strokeWidth="2"
          />
        </>
      )}
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

function Tooltip({
  x,
  y,
  label,
  valueText,
  chartWidth,
}: {
  x: number;
  y: number;
  label: string;
  valueText: string;
  chartWidth: number;
}) {
  const { colors, radius } = useTheme();
  // Estimate width based on content — each char ~7px, padding 16
  // either side. Clamped to chart bounds so the tooltip never
  // hangs off the edge.
  const contentLen = Math.max(label.length, valueText.length);
  const estimatedW = Math.max(TOOLTIP_MIN_W, contentLen * 8 + 16);
  const left = Math.max(
    4,
    Math.min(chartWidth - estimatedW - 4, x - estimatedW / 2),
  );
  // Place above the touch point; if too close to top, put below.
  const above = y > TOOLTIP_HEIGHT + 8;
  const top = above ? y - TOOLTIP_HEIGHT - 8 : y + 8;

  return (
    <View
      pointerEvents="none"
      style={[
        s.tooltip,
        {
          left,
          top,
          width: estimatedW,
          backgroundColor: colors.text,
          borderRadius: radius.md,
        },
      ]}
    >
      <Text
        variant="caption"
        style={{ color: 'rgba(255,255,255,0.7)', fontSize: 10 }}
      >
        {label}
      </Text>
      <Text
        variant="body"
        style={{ color: '#FFF', fontWeight: '700', fontSize: 14 }}
      >
        {valueText}
      </Text>
    </View>
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
  tooltip: {
    position: 'absolute',
    paddingHorizontal: 10,
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 4,
  },
});
