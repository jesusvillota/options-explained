import { Line, Point, Polyline } from 'mafs';
import { useMemo, useState } from 'react';
import { brownianPath } from '../../lib/math/brownian';
import { DEFAULTS, price } from '../../lib/pricing/blackScholes';
import { barrierPrice } from '../../lib/pricing/exotics';
import { Button, Slider } from '../ui/controls';
import { WidgetFrame } from '../ui/WidgetFrame';
import { money } from './format';
import { Label, PlotFrame } from './PlotFrame';

const N = 400;
const SIGMA = 0.2;

/** First seed at or after `start` whose path (in log price, no drift) touches the barrier. */
function hittingSeed(start: number, logB: number): number {
  for (let s = start; s < start + 500; s++) {
    if (brownianPath(s, N).some((w) => SIGMA * w <= logB)) return s;
  }
  return start;
}

/**
 * Chapter 38: the reflection principle. A driftless log-price path that
 * touches the barrier b, and from that moment its mirror image 2b − x. Every
 * path that touches the barrier and ends at x has a twin ending at 2b − x, so
 * hitting probabilities become ordinary end-point probabilities. Below: the
 * down-and-out call's value for every barrier level.
 */
export default function BarrierReflection() {
  const [H, setH] = useState(88);
  const [start, setStart] = useState(1);
  const logB = Math.log(H / 100);
  const seed = useMemo(() => hittingSeed(start, logB), [start, logB]);
  const x = useMemo(() => brownianPath(seed, N).map((w) => SIGMA * w), [seed]);
  const hit = x.findIndex((v) => v <= logB);
  const t = (i: number) => i / N;
  const path = x.map((v, i) => [t(i), 100 * Math.exp(v)] as [number, number]);
  const twin = hit >= 0 ? x.slice(hit).map((v, j) => [t(hit + j), 100 * Math.exp(2 * logB - v)] as [number, number]) : [];
  const lo = Math.min(...path.map(([, s]) => s), ...twin.map(([, s]) => s), H) * 0.97;
  const hi = Math.max(...path.map(([, s]) => s), ...twin.map(([, s]) => s)) * 1.03;
  const vanilla = price('call', DEFAULTS);
  const out = barrierPrice('call', 'down-and-out', DEFAULTS, H);
  const curve = Array.from({ length: 60 }, (_, i) => { const b = 60 + i * (39.5 / 59); return [b, barrierPrice('call', 'down-and-out', DEFAULTS, b)] as [number, number]; });

  const top = (
    <PlotFrame x={[0, 1]} y={[lo, hi]} height={200} xTicks={[0, 0.25, 0.5, 0.75, 1]} yTicks={[70, 80, 90, 100, 110, 120, 130, 140].filter((v) => v > lo && v < hi)} formatX={(v) => `t = ${v}`} formatY={(v) => money(v, 0)} yLabel="stock price">
      <Line.Segment point1={[0, H]} point2={[1, H]} color="var(--c-put)" weight={2} />
      <Label x={0.01} y={H} attach="ne" attachDistance={4} size={12} color="var(--c-put)">barrier {money(H, 0)}</Label>
      {twin.length > 0 && <Polyline points={twin} color="var(--c-vol)" weight={2} strokeStyle="dashed" fillOpacity={0} />}
      <Polyline points={path} color="var(--c-spot)" weight={2} fillOpacity={0} />
      {hit >= 0 && <Point x={t(hit)} y={H} color="var(--c-put)" />}
      {twin.length > 0 && <Label x={1} y={twin[twin.length - 1][1]} attach="w" attachDistance={8} size={12} color="var(--c-vol)">reflected twin</Label>}
    </PlotFrame>
  );
  const bottom = (
    <div style={{ borderTop: '1px solid var(--border)' }}>
      <PlotFrame x={[60, 100]} y={[0, vanilla * 1.15]} height={150} xTicks={[60, 70, 80, 90, 100]} yTicks={[0, 5, 10]} formatX={(v) => `$${v}`} formatY={(v) => money(v, 0)} xLabel="barrier level" yLabel="down-and-out call">
        <Line.Segment point1={[60, vanilla]} point2={[100, vanilla]} color="var(--text-muted)" style="dashed" weight={1} />
        <Polyline points={curve} color="var(--c-call)" weight={2.5} fillOpacity={0} />
        <Point x={H} y={out} color="var(--c-call)" />
        <Label x={72} y={vanilla} attach="s" attachDistance={6} size={11} color="var(--text-muted)">vanilla call {money(vanilla)}</Label>
      </PlotFrame>
    </div>
  );

  return (
    <WidgetFrame
      title="Barriers and the reflection principle"
      ariaLabel={`A path touches the ${H} barrier at t = ${hit >= 0 ? t(hit).toFixed(2) : 'never'}; its reflected twin is drawn dashed. A down-and-out call with this barrier is worth ${money(out)} against ${money(vanilla)} for the vanilla.`}
      plotHeight={350}
      plot={<>{top}{bottom}</>}
      controls={
        <>
          <Slider label="Barrier H" value={H} min={60} max={99} step={1} onChange={setH} format={(v) => money(v, 0)} color="var(--c-put)" />
          <Button onClick={() => setStart(seed + 1)}>Another path</Button>
        </>
      }
      readout={
        <dl className="readout-grid">
          <dt>Down-and-out call (K = $100)</dt><dd>{money(out)} <span className="muted">vanilla {money(vanilla)}, knock-in {money(vanilla - out)}</span></dd>
          <dt>This path</dt><dd>{hit >= 0 ? `touches the barrier at t = ${t(hit).toFixed(2)}: a down-and-out option on it is dead` : 'never touches the barrier'}</dd>
        </dl>
      }
      caption="Top: a log-price path without drift (σ = 20%) that touches the barrier, and after the first touch its mirror image (dashed). Both are equally likely. Bottom: the down-and-out call's value for each barrier, against the vanilla (dashed)."
    />
  );
}
