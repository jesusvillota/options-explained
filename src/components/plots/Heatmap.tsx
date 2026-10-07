import { useEffect, useRef, useState } from 'react';

interface HeatmapProps {
  /** Value at (x, y). */
  f: (x: number, y: number) => number;
  x: [number, number];
  y: [number, number];
  height: number;
  /** CSS colour variable for the high end, e.g. '--c-call'. Negative values use `negativeColor`. */
  color: string;
  negativeColor?: string;
  /** Fixed colour range; defaults to the data range. */
  range?: [number, number];
  xTicks: number[];
  yTicks: number[];
  formatX?: (v: number) => string;
  formatY?: (v: number) => string;
  formatValue?: (v: number) => string;
  xLabel?: string;
  yLabel?: string;
  /** Crosshair marker in data coordinates. */
  marker?: [number, number];
  /** Grid resolution. */
  nx?: number;
  ny?: number;
}

const MARGIN = { left: 52, right: 14, top: 10, bottom: 40 };

function readColor(el: Element, name: string): [number, number, number] {
  const raw = getComputedStyle(el).getPropertyValue(name).trim();
  const probe = document.createElement('div');
  probe.style.color = raw;
  document.body.appendChild(probe);
  const rgb = getComputedStyle(probe).color.match(/\d+(\.\d+)?/g)!.map(Number);
  probe.remove();
  return [rgb[0], rgb[1], rgb[2]];
}

/**
 * A colour map of a function of two variables, drawn on a canvas (Chapters
 * 20, 23, 26). Colours come from the theme's CSS variables and follow the
 * light/dark toggle.
 */
export function Heatmap({
  f, x, y, height, color, negativeColor = '--c-put', range, xTicks, yTicks,
  formatX = String, formatY = String, formatValue = (v) => v.toFixed(2), xLabel, yLabel, marker, nx = 120, ny = 80,
}: HeatmapProps) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [width, setWidth] = useState(0);
  const [themeTick, setThemeTick] = useState(0);
  const [hover, setHover] = useState<{ px: number; py: number; v: number; x: number; y: number } | null>(null);

  useEffect(() => {
    const el = wrap.current!;
    const ro = new ResizeObserver(([e]) => setWidth(Math.floor(e.contentRect.width)));
    ro.observe(el);
    const mo = new MutationObserver(() => setThemeTick((t) => t + 1));
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => { ro.disconnect(); mo.disconnect(); };
  }, []);

  const plotW = Math.max(width - MARGIN.left - MARGIN.right, 10);
  const plotH = height - MARGIN.top - MARGIN.bottom;
  const toPx = (vx: number) => MARGIN.left + ((vx - x[0]) / (x[1] - x[0])) * plotW;
  const toPy = (vy: number) => MARGIN.top + (1 - (vy - y[0]) / (y[1] - y[0])) * plotH;

  const values: number[][] = [];
  for (let j = 0; j < ny; j++) {
    const row: number[] = [];
    const vy = y[0] + ((j + 0.5) / ny) * (y[1] - y[0]);
    for (let i = 0; i < nx; i++) row.push(f(x[0] + ((i + 0.5) / nx) * (x[1] - x[0]), vy));
    values.push(row);
  }
  const flat = values.flat().filter(Number.isFinite);
  const [lo, hi] = range ?? [Math.min(...flat), Math.max(...flat)];

  useEffect(() => {
    const c = canvas.current;
    if (!c || width === 0) return;
    const root = document.documentElement;
    const hiC = readColor(root, color);
    const negC = readColor(root, negativeColor);
    const base = readColor(root, '--bg-inset');
    const img = new ImageData(nx, ny);
    const span = Math.max(Math.abs(hi), Math.abs(lo), 1e-12);
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const v = values[j][i];
        const target = v >= 0 ? hiC : negC;
        const t = lo >= 0 ? (v - lo) / Math.max(hi - lo, 1e-12) : Math.abs(v) / span;
        const k = Math.min(Math.max(t, 0), 1) ** 0.85;
        const o = ((ny - 1 - j) * nx + i) * 4;
        img.data[o] = base[0] + (target[0] - base[0]) * k;
        img.data[o + 1] = base[1] + (target[1] - base[1]) * k;
        img.data[o + 2] = base[2] + (target[2] - base[2]) * k;
        img.data[o + 3] = 255;
      }
    }
    const off = document.createElement('canvas');
    off.width = nx;
    off.height = ny;
    off.getContext('2d')!.putImageData(img, 0, 0);
    const ctx = c.getContext('2d')!;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(off, MARGIN.left, MARGIN.top, plotW, plotH);
  });

  const onMove = (e: React.PointerEvent) => {
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    const px = e.clientX - rect.left, py = e.clientY - rect.top;
    if (px < MARGIN.left || px > MARGIN.left + plotW || py < MARGIN.top || py > MARGIN.top + plotH) return setHover(null);
    const vx = x[0] + ((px - MARGIN.left) / plotW) * (x[1] - x[0]);
    const vy = y[0] + (1 - (py - MARGIN.top) / plotH) * (y[1] - y[0]);
    setHover({ px, py, v: f(vx, vy), x: vx, y: vy });
  };

  return (
    <div ref={wrap} style={{ position: 'relative', width: '100%', height, fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--text-muted)' }} data-theme-tick={themeTick}>
      {width > 0 && (
        <>
          <canvas ref={canvas} width={width} height={height} style={{ position: 'absolute', inset: 0, width, height }} onPointerMove={onMove} onPointerLeave={() => setHover(null)} />
          <svg width={width} height={height} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
            {xTicks.map((t) => (
              <text key={`x${t}`} x={toPx(t)} y={MARGIN.top + plotH + 16} textAnchor="middle" fill="currentColor">{formatX(t)}</text>
            ))}
            {yTicks.map((t) => (
              <text key={`y${t}`} x={MARGIN.left - 8} y={toPy(t)} textAnchor="end" dominantBaseline="middle" fill="currentColor">{formatY(t)}</text>
            ))}
            {xLabel && <text x={MARGIN.left + plotW} y={height - 4} textAnchor="end" fill="currentColor">{xLabel}</text>}
            {yLabel && <text x={MARGIN.left + 6} y={MARGIN.top + 14} fill="var(--text)" style={{ paintOrder: 'stroke', stroke: 'var(--bg-inset)', strokeWidth: 4 }}>{yLabel}</text>}
            {marker && (
              <g stroke="var(--text)" strokeWidth={1.5}>
                <line x1={toPx(marker[0])} x2={toPx(marker[0])} y1={MARGIN.top} y2={MARGIN.top + plotH} strokeDasharray="4 3" />
                <line x1={MARGIN.left} x2={MARGIN.left + plotW} y1={toPy(marker[1])} y2={toPy(marker[1])} strokeDasharray="4 3" />
                <circle cx={toPx(marker[0])} cy={toPy(marker[1])} r={5} fill="var(--c-spot)" stroke="var(--bg-inset)" strokeWidth={2} />
              </g>
            )}
            {hover && (
              <text x={Math.min(hover.px + 10, width - 120)} y={Math.max(hover.py - 10, 16)} fill="var(--text)" style={{ paintOrder: 'stroke', stroke: 'var(--bg-inset)', strokeWidth: 4 }}>
                {formatX(hover.x)}, {formatY(hover.y)} → {formatValue(hover.v)}
              </text>
            )}
          </svg>
        </>
      )}
      <div style={{ position: 'absolute', right: MARGIN.right + 4, top: MARGIN.top + 4, display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-inset)', padding: '2px 6px', borderRadius: 4 }}>
        <span>{formatValue(lo)}</span>
        <span style={{ width: 60, height: 8, borderRadius: 2, background: `linear-gradient(to right, ${lo < 0 ? `var(${negativeColor}), var(--bg-inset),` : 'var(--bg-inset),'} var(${color}))` }} />
        <span>{formatValue(hi)}</span>
      </div>
    </div>
  );
}
