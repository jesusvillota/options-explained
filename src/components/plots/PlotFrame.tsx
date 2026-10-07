import { Line, Mafs, useTransformContext, vec } from 'mafs';
import { useEffect, useRef, useState, type ReactNode } from 'react';

/** Pixel space reserved around the data area for tick labels and axis titles. */
const DEFAULT_MARGIN = { left: 48, right: 30, top: 14, bottom: 44 };

interface PlotFrameProps {
  x: [number, number];
  y: [number, number];
  height: number;
  xTicks: number[];
  yTicks: number[];
  formatX?: (v: number) => string;
  formatY?: (v: number) => string;
  xLabel?: ReactNode;
  yLabel?: ReactNode;
  /** Draw a stronger horizontal line at this y (e.g. zero profit). */
  baseline?: number;
  /** Pixel room for the y tick labels (widen for long labels like "+2,000"). */
  marginLeft?: number;
  children: ReactNode;
}

/**
 * A Mafs canvas with data-space axes drawn at the edges (Mafs's own axes sit at
 * x = 0 and y = 0, which is often off-screen for prices). Children draw in
 * data coordinates as usual.
 */
export function PlotFrame({ x, y, height, xTicks, yTicks, formatX = String, formatY = String, xLabel, yLabel, baseline, marginLeft, children }: PlotFrameProps) {
  const MARGIN = { ...DEFAULT_MARGIN, left: marginLeft ?? DEFAULT_MARGIN.left };
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const [x0, x1] = x;
  const [y0, y1] = y;
  const ux = (x1 - x0) / Math.max(width - MARGIN.left - MARGIN.right, 1);
  const uy = (y1 - y0) / (height - MARGIN.top - MARGIN.bottom);
  // On narrow screens, label every other x tick so the labels don't collide.
  const tickGapPx = xTicks.length > 1 ? (xTicks[1] - xTicks[0]) / ux : Infinity;
  const xLabelTicks = tickGapPx < 46 ? xTicks.filter((_, i) => i % 2 === 0) : xTicks;
  const viewBox = {
    x: [x0 - MARGIN.left * ux, x1 + MARGIN.right * ux] as [number, number],
    y: [y0 - MARGIN.bottom * uy, y1 + MARGIN.top * uy] as [number, number],
    padding: 0,
  };

  return (
    <div ref={ref} style={{ width: '100%', height }}>
      {width > 0 && (
        <Mafs width={width} height={height} viewBox={viewBox} preserveAspectRatio={false} pan={false} zoom={false}>
          {xTicks.map((t) => (
            <Line.Segment key={`gx${t}`} point1={[t, y0]} point2={[t, y1]} color="var(--grid)" weight={1} />
          ))}
          {yTicks.map((t) => (
            <Line.Segment key={`gy${t}`} point1={[x0, t]} point2={[x1, t]} color="var(--grid)" weight={1} />
          ))}
          <Line.Segment point1={[x0, y0]} point2={[x1, y0]} color="var(--axis)" weight={1} />
          <Line.Segment point1={[x0, y0]} point2={[x0, y1]} color="var(--axis)" weight={1} />
          {baseline !== undefined && <Line.Segment point1={[x0, baseline]} point2={[x1, baseline]} color="var(--axis)" weight={1.5} />}
          {xLabelTicks.map((t) => (
            <Label key={`lx${t}`} x={t} y={y0} attach="s" attachDistance={8} size={12} color="var(--text-muted)">
              {formatX(t)}
            </Label>
          ))}
          {yTicks.map((t) => (
            <Label key={`ly${t}`} x={x0} y={t} attach="w" attachDistance={8} size={12} color="var(--text-muted)">
              {formatY(t)}
            </Label>
          ))}
          {xLabel && (
            <Label x={x1} y={y0 - 26 * uy} attach="sw" attachDistance={0} size={12} color="var(--text-muted)">
              {xLabel}
            </Label>
          )}
          {yLabel && (
            <Label x={x0} y={y1} attach="se" attachDistance={6} size={12} color="var(--text-muted)">
              {yLabel}
            </Label>
          )}
          {children}
        </Mafs>
      )}
    </div>
  );
}

/** Subscript for SVG text labels: <Sub base="S" sub="T" /> renders S_T. */
export function Sub({ base, sub }: { base: string; sub: string }) {
  return (
    <>
      <tspan fontStyle="italic">{base}</tspan>
      <tspan fontSize="0.75em" dy="0.3em">{sub}</tspan>
      <tspan dy="-0.3em"> </tspan>
    </>
  );
}

type Direction = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

interface LabelProps {
  x: number;
  y: number;
  /** Which side of (x, y) the text sits on. */
  attach?: Direction;
  /** Gap between the point and the text, in px. */
  attachDistance?: number;
  size?: number;
  color?: string;
  children: ReactNode;
}

/**
 * Text placed next to a data point. Like Mafs's <Text>, but `n` puts the
 * text above the point and `s` below it at any distance (Mafs's own
 * vertical offset points the wrong way when attachDistance > 0).
 */
export function Label({ x, y, attach, attachDistance = 0, size = 13, color = 'var(--text)', children }: LabelProps) {
  const { viewTransform, userTransform } = useTransformContext();
  const [cx, cy] = vec.transform([x, y], vec.matrixMult(viewTransform, userTransform));
  const dx = attach?.includes('w') ? -1 : attach?.includes('e') ? 1 : 0;
  const dy = attach?.includes('n') ? -1 : attach?.includes('s') ? 1 : 0;
  const [ox, oy] = dx || dy ? vec.withMag([dx, dy], attachDistance) : [0, 0];
  return (
    <text
      x={cx + ox}
      y={cy + oy}
      fontSize={size}
      textAnchor={dx < 0 ? 'end' : dx > 0 ? 'start' : 'middle'}
      dominantBaseline={dy < 0 ? 'auto' : dy > 0 ? 'hanging' : 'middle'}
      className="mafs-shadow"
      style={{ fill: color }}
    >
      {children}
    </text>
  );
}
