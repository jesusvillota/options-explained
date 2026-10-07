import { Line, Point, Polyline } from 'mafs';
import { useMemo, useState } from 'react';
import { blackScholesCF, lewisCallPrice, type CharFn } from '../../lib/models/fourier';
import { HESTON_DEFAULTS, hestonCF } from '../../lib/models/heston';
import { MERTON_DEFAULTS, mertonCF } from '../../lib/models/jumps';
import { cosCallPrice, cosDensity, truncationRange } from '../../lib/numerics/cos';
import { Segmented, Slider } from '../ui/controls';
import { WidgetFrame } from '../ui/WidgetFrame';
import { money } from './format';
import { Label, PlotFrame } from './PlotFrame';

type Model = 'bs' | 'heston' | 'merton';
const S = 100, K = 100, r = 0.03;
const MODELS: Record<Model, { label: string; cf: (T: number) => CharFn }> = {
  bs: { label: 'Black–Scholes', cf: (T) => blackScholesCF(0.2, T) },
  heston: { label: 'Heston', cf: (T) => hestonCF(HESTON_DEFAULTS, T) },
  merton: { label: 'Merton jumps', cf: (T) => mertonCF(MERTON_DEFAULTS, T) },
};
const NS = [2, 4, 8, 16, 32, 64, 128];
const sup = (n: number) => `${n < 0 ? '⁻' : ''}${String(Math.abs(n)).split('').map((d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[Number(d)]).join('')}`;

/**
 * Chapter 35: the COS method. Top: the density of ln(S_T/F) rebuilt from N
 * cosine terms (exact: 256 terms, dashed). Bottom: the price error against N
 * on a log scale: it falls exponentially until it hits machine precision.
 */
export default function COSReconstruction() {
  const [model, setModel] = useState<Model>('heston');
  const [n, setN] = useState(8);
  const [T, setT] = useState(0.5);
  const phi = useMemo(() => MODELS[model].cf(T), [model, T]);
  const range = useMemo(() => truncationRange(phi), [phi]);
  const reference = useMemo(() => lewisCallPrice(phi, S, K, T, r, 0, { uMax: 400 }), [phi, T]);
  const [a, b] = range;
  // Show the central part of the truncation interval, where the density lives.
  const lo = a + 0.3 * (b - a), hi = b - 0.3 * (b - a);
  const ys = Array.from({ length: 161 }, (_, i) => lo + ((hi - lo) * i) / 160);
  const exact = useMemo(() => ys.map((y) => [y, cosDensity(phi, y, 256, range)] as [number, number]), [phi, range]); // ys derive from range
  const approx = ys.map((y) => [y, cosDensity(phi, y, n, range)] as [number, number]);
  const dMax = Math.max(...exact.map(([, d]) => d)) * 1.25;
  const dMin = Math.min(0, ...approx.map(([, d]) => d)) * 1.1;
  const errors = useMemo(() => NS.map((m) => [Math.log2(m), Math.log10(Math.max(Math.abs(cosCallPrice(phi, S, K, T, r, 0, m, range) - reference), 1e-15))] as [number, number]), [phi, range, reference, T]);
  const current = cosCallPrice(phi, S, K, T, r, 0, n, range);

  const density = (
    <PlotFrame x={[lo, hi]} y={[dMin, dMax]} height={180} xTicks={[-0.6, -0.4, -0.2, 0, 0.2, 0.4, 0.6].filter((t) => t > lo && t < hi)} yTicks={[]} formatX={(v) => `${v >= 0 ? '+' : '−'}${Math.abs(v * 100).toFixed(0)}%`} baseline={0} xLabel="log-return ln(S_T/F)" yLabel="density">
      <Polyline points={exact} color="var(--text-muted)" weight={1.5} strokeStyle="dashed" fillOpacity={0} />
      <Polyline points={approx} color="var(--c-prob)" weight={2.5} fillOpacity={0} />
    </PlotFrame>
  );
  const errPlot = (
    <div style={{ borderTop: '1px solid var(--border)' }}>
      <PlotFrame x={[0.6, 7.4]} y={[-15, 1]} height={150} xTicks={NS.map(Math.log2)} yTicks={[-15, -10, -5, 0]} formatX={(v) => String(2 ** Math.round(v))} formatY={(v) => (v === 0 ? '1' : `10${sup(v)}`)} xLabel="cosine terms N" yLabel="|price error|" marginLeft={50}>
        <Polyline points={errors} color="var(--c-vol)" weight={2.5} fillOpacity={0} />
        {errors.map(([x, y]) => <Point key={x} x={x} y={y} color={Math.abs(x - Math.log2(n)) < 1e-9 ? 'var(--c-vol)' : 'var(--text-muted)'} />)}
        <Line.Segment point1={[Math.log2(n), -15]} point2={[Math.log2(n), 1]} color="var(--c-vol)" style="dashed" weight={1} />
        <Label x={7.4} y={-15} attach="nw" attachDistance={4} size={11} color="var(--text-muted)">machine precision</Label>
      </PlotFrame>
    </div>
  );

  return (
    <WidgetFrame
      title="Rebuilding a density from cosines"
      ariaLabel={`COS method for ${MODELS[model].label}: with ${n} terms the at-the-money call is ${money(current, 6)}, against ${money(reference, 6)}.`}
      plotHeight={330}
      plot={<>{density}{errPlot}</>}
      controls={
        <>
          <Segmented label="Model" value={model} onChange={setModel} options={(Object.keys(MODELS) as Model[]).map((k) => ({ value: k, label: MODELS[k].label }))} />
          <Segmented label="Cosine terms N" value={String(n)} onChange={(v) => setN(Number(v))} options={NS.map((m) => ({ value: String(m), label: String(m) }))} />
          <Slider label="Maturity $\Time{T}$" value={T} min={0.05} max={2} step={0.05} onChange={setT} format={(v) => `${v.toFixed(2)} yr`} color="var(--c-time)" />
        </>
      }
      readout={
        <dl className="readout-grid">
          <dt>Call price with N = {n}</dt><dd>{money(current, 6)}</dd>
          <dt>Reference (Lewis integral)</dt><dd>{money(reference, 6)} <span className="muted">error {Math.abs(current - reference).toExponential(1)}</span></dd>
        </dl>
      }
      caption="At-the-money call, $\Spot{S} = \Strike{K} = 100$, $\Rate{r} = 3\%$. Top: the density from N cosine terms (solid) against 256 terms (dashed); with few terms it wiggles and even dips below zero. Bottom: the pricing error for each N."
    />
  );
}
