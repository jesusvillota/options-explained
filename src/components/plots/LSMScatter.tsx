import { Line, Point, Polyline } from 'mafs';
import { useMemo, useState } from 'react';
import { longstaffSchwartz } from '../../lib/numerics/lsm';
import { binomialPrice, exerciseBoundary } from '../../lib/pricing/binomial';
import { price } from '../../lib/pricing/blackScholes';
import { Button, Segmented, Slider } from '../ui/controls';
import { WidgetFrame } from '../ui/WidgetFrame';
import { money } from './format';
import { Label, PlotFrame } from './PlotFrame';

type Paths = '2000' | '10000' | '40000';
const INPUT = { S: 100, K: 100, T: 1, r: 0.06, sigma: 0.2 };
const STEPS = 20;
const SHOWN = 400; // scatter points drawn

/**
 * Chapter 36: Longstaff–Schwartz for an American put. Top: at one exercise
 * date, the discounted cash flows that in-the-money paths actually went on to
 * earn, the quadratic regression through them (continuation value), and the
 * payoff from exercising now. Bottom: the exercise boundary found at every
 * date, against the binomial tree's.
 */
export default function LSMScatter() {
  const [date, setDate] = useState(10);
  const [paths, setPaths] = useState<Paths>('10000');
  const [seed, setSeed] = useState(1);
  const res = useMemo(() => longstaffSchwartz({ ...INPUT, steps: STEPS, paths: Number(paths), seed }), [paths, seed]);
  const tree = useMemo(() => binomialPrice('put', { ...INPUT, steps: 800, american: true }), []);
  const treeBoundary = useMemo(() => exerciseBoundary('put', { ...INPUT, steps: 200, american: true }, 20), []);
  const european = price('put', INPUT);
  const snap = res.snapshots[date - 1];
  const stride = Math.max(1, Math.floor(snap.S.length / SHOWN));
  const pts = snap.S.map((s, i) => [s, snap.Y[i]] as [number, number]).filter((_, i) => i % stride === 0);
  const cont = (s: number) => snap.beta[0] + snap.beta[1] * (s / INPUT.K) + snap.beta[2] * (s / INPUT.K) ** 2;
  const xs = Array.from({ length: 61 }, (_, i) => 60 + i * (40 / 60));
  const yMax = 40;

  const top = (
    <PlotFrame x={[60, 100]} y={[0, yMax]} height={200} xTicks={[60, 70, 80, 90, 100]} yTicks={[0, 10, 20, 30, 40]} formatX={(v) => `$${v}`} formatY={(v) => money(v, 0)} xLabel={`stock price at t = ${snap.t.toFixed(2)} (in-the-money paths)`} yLabel="cash flow">
      {pts.map(([s, y], i) => <Point key={i} x={s} y={Math.min(y, yMax)} color="var(--c-prob)" opacity={0.35} svgCircleProps={{ r: 2 }} />)}
      <Polyline points={xs.map((s) => [s, 100 - s] as [number, number])} color="var(--c-put)" weight={2.5} fillOpacity={0} />
      <Polyline points={xs.map((s) => [s, cont(s)] as [number, number])} color="var(--c-vol)" weight={3} fillOpacity={0} />
      {Number.isFinite(snap.boundary) && <Line.Segment point1={[snap.boundary, 0]} point2={[snap.boundary, yMax]} color="var(--c-strike)" style="dashed" weight={1.5} />}
      <Label x={61} y={2} attach="ne" size={12} color="var(--c-put)">red: exercise now, K − S</Label>
      <Label x={99} y={cont(99)} attach="nw" attachDistance={6} size={12} color="var(--c-vol)">fitted continuation</Label>
    </PlotFrame>
  );
  const bottom = (
    <div style={{ borderTop: '1px solid var(--border)' }}>
      <PlotFrame x={[0, 1]} y={[70, 100]} height={150} xTicks={[0, 0.25, 0.5, 0.75, 1]} yTicks={[70, 80, 90, 100]} formatX={(v) => `t = ${v}`} formatY={(v) => money(v, 0)} yLabel="exercise below">
        <Polyline points={treeBoundary.filter((b) => b.S !== null).map((b) => [b.t, b.S!] as [number, number])} color="var(--text-muted)" weight={2} strokeStyle="dashed" fillOpacity={0} />
        <Polyline points={res.snapshots.filter((s) => Number.isFinite(s.boundary)).map((s) => [s.t, s.boundary] as [number, number])} color="var(--c-strike)" weight={2.5} fillOpacity={0} />
        {Number.isFinite(snap.boundary) && <Point x={snap.t} y={snap.boundary} color="var(--c-strike)" />}
        <Label x={0.02} y={treeBoundary[1].S ?? 85} attach="ne" attachDistance={6} size={11} color="var(--text-muted)">binomial tree</Label>
      </PlotFrame>
    </div>
  );

  return (
    <WidgetFrame
      title="Regression decides when to exercise"
      ariaLabel={`Longstaff–Schwartz American put: ${money(res.price, 3)} ± ${money(2 * res.stdError, 3)} with ${paths} paths, against ${money(tree, 3)} from a binomial tree. At t = ${snap.t.toFixed(2)}, exercise below ${Number.isFinite(snap.boundary) ? money(snap.boundary, 1) : 'no price'}.`}
      plotHeight={350}
      plot={<>{top}{bottom}</>}
      controls={
        <>
          <Slider label="Exercise date" value={date} min={1} max={STEPS - 1} step={1} onChange={setDate} format={(v) => `t = ${(v / STEPS).toFixed(2)}`} color="var(--c-time)" />
          <Segmented label="Paths" value={paths} onChange={setPaths} options={[
            { value: '2000', label: '2,000' },
            { value: '10000', label: '10,000' },
            { value: '40000', label: '40,000' },
          ]} />
          <Button onClick={() => setSeed((s) => s + 1)}>New paths</Button>
        </>
      }
      readout={
        <dl className="readout-grid">
          <dt>Longstaff–Schwartz</dt><dd>{money(res.price, 3)} <span className="muted">± {money(2 * res.stdError, 3)}</span></dd>
          <dt>Binomial tree (800 steps)</dt><dd>{money(tree, 3)}</dd>
          <dt>European put (Black–Scholes)</dt><dd>{money(european, 3)} <span className="muted">early-exercise premium ≈ {money(res.price - european, 3)}</span></dd>
        </dl>
      }
      caption="American put, $\Spot{S} = \Strike{K} = 100$, one year, $\Rate{r} = 6\%$, $\Vol{\sigma} = 20\%$, 20 exercise dates. Dots: a sample of in-the-money paths. Exercise where the red line is above the purple one: left of the yellow dashed line."
    />
  );
}
