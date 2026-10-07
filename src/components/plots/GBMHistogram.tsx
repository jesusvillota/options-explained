import { Line, Polyline } from 'mafs';
import { useMemo, useState } from 'react';
import { lognormalMean, lognormalMedian, lognormalPdf } from '../../lib/math/lognormal';
import { cdf } from '../../lib/math/normal';
import { gbmPath, normalRng } from '../../lib/math/rng';
import { Button, Slider } from '../ui/controls';
import { WidgetFrame } from '../ui/WidgetFrame';
import { money, niceTicks } from './format';
import { Label, PlotFrame, Sub } from './PlotFrame';

const S0 = 100;
const PATHS = 25;
const SAMPLES = 4000;
const STEPS = 120;
const BINS = 40;

/**
 * Chapter 16: geometric Brownian motion. Top: sample paths. Bottom: a
 * histogram of S_T from many simulations against the lognormal density, with
 * the mean S0 e^{μT} and the (lower) median S0 e^{(μ−σ²/2)T}.
 */
export default function GBMHistogram() {
  const [mu, setMu] = useState(0.08);
  const [sigma, setSigma] = useState(0.3);
  const [T, setT] = useState(3);
  const [seed, setSeed] = useState(1);
  const params = { S0, mu, sigma, T };
  const mean = lognormalMean(params);
  const median = lognormalMedian(params);
  const xMax = Math.min(Math.max(S0 * Math.exp(mu * T + 2.5 * sigma * Math.sqrt(T)), 150), 1200);
  const paths = useMemo(() => Array.from({ length: PATHS }, (_, k) => gbmPath(seed * 100 + k, S0, mu, sigma, T, STEPS)), [seed, mu, sigma, T]);
  const samples = useMemo(() => {
    const z = normalRng(seed * 7 + 3);
    return Array.from({ length: SAMPLES }, () => S0 * Math.exp((mu - 0.5 * sigma * sigma) * T + sigma * Math.sqrt(T) * z()));
  }, [seed, mu, sigma, T]);
  const w = xMax / BINS;
  const hist = Array.from({ length: BINS }, (_, b) => samples.filter((s) => s >= b * w && s < (b + 1) * w).length / (SAMPLES * w));
  const curve = Array.from({ length: 201 }, (_, i) => (i * xMax) / 200).map((x) => [x, lognormalPdf(x, params)] as [number, number]);
  const yMax = Math.max(...hist, ...curve.map((c) => c[1])) * 1.15;
  const empMean = samples.reduce((a, b) => a + b, 0) / SAMPLES;
  const pBelow = cdf(-((mu - 0.5 * sigma * sigma) * Math.sqrt(T)) / sigma);
  const yTop = Math.max(...paths.flat()) * 1.05;
  const topTicks = niceTicks(0, yTop, 4);
  const xTicks = niceTicks(0, xMax, 4);

  const top = (
    <PlotFrame x={[0, T]} y={[0, yTop]} height={220} xTicks={[0, T / 2, T]} yTicks={topTicks} formatX={(t) => `${t} yr`} formatY={(v) => `$${v}`} yLabel="stock price">
      {paths.map((p, k) => <Polyline key={k} points={p.map((v, i) => [(i * T) / STEPS, v] as [number, number])} color="var(--c-spot)" weight={1.2} strokeOpacity={0.55} fillOpacity={0} />)}
      <Line.Segment point1={[0, S0]} point2={[T, S0]} color="var(--text-muted)" style="dashed" weight={1} />
    </PlotFrame>
  );
  const bottom = (
    <div style={{ borderTop: '1px solid var(--border)' }}>
      <PlotFrame x={[0, xMax]} y={[0, yMax]} height={220} xTicks={xTicks} yTicks={[]} formatX={(v) => `$${v}`} xLabel={<>stock price at T, <Sub base="S" sub="T" /></>} yLabel="frequency">
        {hist.map((h, b) => <Line.Segment key={b} point1={[(b + 0.5) * w, 0]} point2={[(b + 0.5) * w, h]} color="var(--c-prob)" weight={Math.max(2, 400 / BINS)} opacity={0.45} />)}
        <Polyline points={curve} color="var(--c-vol)" weight={2.5} fillOpacity={0} />
        <Line.Segment point1={[median, 0]} point2={[median, yMax]} color="var(--c-rate)" weight={2} style="dashed" />
        <Line.Segment point1={[mean, 0]} point2={[mean, yMax]} color="var(--c-spot)" weight={2} style="dashed" />
        <Label x={median} y={yMax * 0.95} attach="w" attachDistance={6} size={12} color="var(--c-rate)">median</Label>
        <Label x={mean} y={yMax * 0.85} attach="e" attachDistance={6} size={12} color="var(--c-spot)">mean</Label>
      </PlotFrame>
    </div>
  );

  return (
    <WidgetFrame
      title="Geometric Brownian motion"
      ariaLabel={`GBM with drift ${Math.round(mu * 100)}% and volatility ${Math.round(sigma * 100)}% over ${T} years: mean ${money(mean)}, median ${money(median)}.`}
      plotHeight={440}
      plot={<>{top}{bottom}</>}
      controls={
        <>
          <Slider label="Drift $\mu$" value={mu} min={-0.1} max={0.2} step={0.01} onChange={setMu} format={(v) => `${Math.round(v * 100)}%`} color="var(--c-rate)" />
          <Slider label="Volatility $\Vol{\sigma}$" value={sigma} min={0.05} max={0.8} step={0.01} onChange={setSigma} format={(v) => `${Math.round(v * 100)}%`} color="var(--c-vol)" />
          <Slider label="Horizon $\Time{T}$" value={T} min={0.25} max={10} step={0.25} onChange={setT} format={(v) => `${v} yr`} color="var(--c-time)" />
          <Button onClick={() => setSeed((s) => s + 1)}>Re-simulate</Button>
        </>
      }
      readout={
        <dl className="readout-grid">
          <dt>Mean S₀e^(μT)</dt><dd style={{ color: 'var(--c-spot)' }}>{money(mean)} <span className="muted">(simulated: {money(empMean)})</span></dd>
          <dt>Median S₀e^((μ−σ²/2)T)</dt><dd style={{ color: 'var(--c-rate)' }}>{money(median)}</dd>
          <dt>Chance of ending below $100</dt><dd>{(pBelow * 100).toFixed(1)}%</dd>
        </dl>
      }
      caption="Top: 25 sample paths. Bottom: where 4,000 simulated paths end up (grey bars) against the lognormal density (purple). Raise the volatility and watch the median fall away from the mean."
    />
  );
}
