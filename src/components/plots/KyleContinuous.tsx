import { Line, Polygon, Polyline } from 'mafs';
import { useMemo, useState } from 'react';
import { kyleContinuous, posteriorVariance, simulateKyleContinuous } from '../../lib/info/kyle';
import { Button, Slider } from '../ui/controls';
import { WidgetFrame } from '../ui/WidgetFrame';
import { extent, money, niceTicks } from './format';
import { Label, PlotFrame } from './PlotFrame';

const P0 = 2.48;
const S0 = 0.3 ** 2;
const T = 1;
const STEPS = 390;
const FAN = 6;
const MULTIPLIER = 100;
const clock = (t: number) => {
  const m = Math.round(t * 390) + 9 * 60 + 30;
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
};

/**
 * Chapter 52: one trading day of continuous-time Kyle. The insider knows the
 * call is worth v and trades at rate (v − p)/(λ(T − t)); noise traders trade at
 * random. The market maker's price is a Brownian motion to it, but from the
 * insider's point of view it's a Brownian bridge that ends at v.
 */
export default function KyleContinuous({ title = 'An insider trades all day' }: { title?: string }) {
  const [v, setV] = useState(2.78);
  const [su, setSu] = useState(1000);
  const [seed, setSeed] = useState(52);
  const eq = kyleContinuous(S0, su, T);
  const main = useMemo(() => simulateKyleContinuous({ p0: P0, sigma0Sq: S0, sigmaU: su, T, steps: STEPS, v, insider: true, seed }), [v, su, seed]);
  const noInsider = useMemo(() => simulateKyleContinuous({ p0: P0, sigma0Sq: S0, sigmaU: su, T, steps: STEPS, v, insider: false, seed }), [v, su, seed]);
  const fan = useMemo(() => Array.from({ length: FAN }, (_, k) => simulateKyleContinuous({ p0: P0, sigma0Sq: S0, sigmaU: su, T, steps: STEPS, v, insider: true, seed: seed * 100 + k + 1 })), [v, su, seed]);

  const band: [number, number][] = [
    ...main.t.map((t, i) => [t, main.p[i] + 2 * Math.sqrt(posteriorVariance(S0, t, T))] as [number, number]),
    ...[...main.t].reverse().map((t, j) => [t, main.p[STEPS - j] - 2 * Math.sqrt(posteriorVariance(S0, t, T))] as [number, number]),
  ];
  const yLo = Math.min(1.7, ...noInsider.p), yHi = Math.max(3.3, ...noInsider.p);
  const top = (
    <PlotFrame x={[0, 1]} y={[yLo, yHi]} height={240} xTicks={[0, 1 / 6.5, 2.5 / 6.5, 4.5 / 6.5, 6.5 / 6.5]} yTicks={niceTicks(yLo, yHi, 5)} formatX={clock} formatY={(y) => y.toFixed(2)} xLabel="time of day" yLabel="price ($ per share)" marginLeft={44}>
      <Polygon points={band} color="var(--c-prob)" fillOpacity={0.12} strokeOpacity={0} />
      {fan.map((f, k) => <Polyline key={k} points={f.t.map((t, i) => [t, f.p[i]] as [number, number])} color="var(--c-spot)" weight={1} strokeOpacity={0.25} fillOpacity={0} />)}
      <Polyline points={noInsider.t.map((t, i) => [t, noInsider.p[i]] as [number, number])} color="var(--text-muted)" weight={1.5} strokeStyle="dashed" fillOpacity={0} />
      <Polyline points={main.t.map((t, i) => [t, main.p[i]] as [number, number])} color="var(--c-spot)" weight={2.5} fillOpacity={0} />
      <Line.Segment point1={[0, v]} point2={[1, v]} color="var(--c-strike)" style="dashed" weight={1.5} />
      <Label x={1} y={v} attach={v >= P0 ? 'nw' : 'sw'} attachDistance={4} size={11} color="var(--c-strike)">insider's value v</Label>
    </PlotFrame>
  );

  const flows = [...main.X, ...main.Z];
  const [fLo, fHi] = extent(flows);
  const fSpan = Math.max(Math.abs(fLo), Math.abs(fHi), 100) * 1.15;
  const bottom = (
    <div style={{ borderTop: '1px solid var(--border)' }}>
      <PlotFrame x={[0, 1]} y={[-fSpan, fSpan]} height={150} xTicks={[0, 1 / 6.5, 2.5 / 6.5, 4.5 / 6.5, 1]} yTicks={niceTicks(-fSpan, fSpan, 4)} formatX={clock} formatY={(y) => `${y > 0 ? '+' : y < 0 ? '−' : ''}${Math.abs(y).toLocaleString('en-US')}`} baseline={0} yLabel="cumulative orders (contracts)" marginLeft={52}>
        <Polyline points={main.t.map((t, i) => [t, main.Z[i]] as [number, number])} color="var(--text-muted)" weight={1.5} fillOpacity={0} />
        <Polyline points={main.t.map((t, i) => [t, main.X[i]] as [number, number])} color="var(--c-put)" weight={2.5} fillOpacity={0} />
        <Label x={1} y={main.X[STEPS]} attach="nw" attachDistance={4} size={11} color="var(--c-put)">insider</Label>
        <Label x={1} y={main.Z[STEPS]} attach="sw" attachDistance={4} size={11} color="var(--text-muted)">noise</Label>
      </PlotFrame>
    </div>
  );

  const noon = Math.round(STEPS * 2.5 / 6.5);
  return (
    <WidgetFrame
      title={title}
      ariaLabel={`The insider values the call at ${v.toFixed(2)}. The price starts at ${P0} and closes at ${main.p[STEPS].toFixed(3)}; without the insider it would close at ${noInsider.p[STEPS].toFixed(3)}.`}
      plotHeight={390}
      plot={<>{top}{bottom}</>}
      controls={
        <>
          <Slider label="Insider's value $v$" value={v} min={1.88} max={3.08} step={0.02} onChange={setV} format={(x) => `$${x.toFixed(2)}`} color="var(--c-strike)" />
          <Slider label="Noise trading $\sigma_u$" value={su} min={200} max={3000} step={100} onChange={setSu} format={(x) => `${x.toLocaleString('en-US')} per √day`} />
          <Button onClick={() => setSeed((s) => s + 1)}>New day</Button>
        </>
      }
      readout={
        <dl className="readout-grid">
          <dt>Price impact</dt><dd>λ = {(eq.lambda * 1e4).toFixed(2)}¢ per 100 contracts, all day <span className="muted">= √Σ0/(σ_u√T)</span></dd>
          <dt>At noon</dt><dd>price {main.p[noon].toFixed(3)} <span className="muted">market's uncertainty ±{Math.round(Math.sqrt(posteriorVariance(S0, main.t[noon], T)) * 100)}¢ (from ±30¢ at the open)</span></dd>
          <dt>At the close</dt><dd>price {main.p[STEPS].toFixed(3)} against v = {v.toFixed(2)}; <span className="muted">without the insider, {noInsider.p[STEPS].toFixed(3)}</span></dd>
          <dt>Insider</dt><dd>bought {Math.round(main.X[STEPS]).toLocaleString('en-US')} contracts, profit <span className={main.profit[STEPS] >= 0 ? 'good' : 'bad'}>{money(main.profit[STEPS] * MULTIPLIER, 0)}</span> <span className="muted">(expected over all values: {money(eq.insiderProfit * MULTIPLIER, 0)})</span></dd>
        </dl>
      }
      caption="Top: the price (blue), six other days with the same insider (faint), and the same noise without the insider (dashed grey). The grey band is ±2 standard deviations of what the market still doesn't know about the value; it narrows like √(1 − t/T). Bottom: cumulative orders of the insider (red) and of noise traders (grey)."
    />
  );
}
