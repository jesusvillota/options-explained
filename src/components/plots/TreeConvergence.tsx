import { Line, Point, Polyline } from 'mafs';
import { useMemo, useState } from 'react';
import { lognormalPdf } from '../../lib/math/lognormal';
import { binomialPrice, terminalDistribution } from '../../lib/pricing/binomial';
import { DEFAULTS, price } from '../../lib/pricing/blackScholes';
import { Slider } from '../ui/controls';
import { WidgetFrame } from '../ui/WidgetFrame';
import { money, signedMoney } from './format';
import { Label, PlotFrame, Sub } from './PlotFrame';

const MAX_N = 200;
const X: [number, number] = [30, 230];

/**
 * Chapter 14: as the number of steps n grows, the tree's distribution of S_T
 * turns into the lognormal and its price converges (with a zig-zag) to
 * Black–Scholes.
 */
export default function TreeConvergence() {
  const [n, setN] = useState(5);
  const bs = price('call', DEFAULTS);
  const prices = useMemo(() => Array.from({ length: MAX_N }, (_, i) => binomialPrice('call', { ...DEFAULTS, steps: i + 1 })), []);
  const dist = terminalDistribution({ ...DEFAULTS, steps: n });
  // Turn probabilities into a density: divide by the spacing around each node.
  const density = dist.map((d, j) => {
    const lo = j > 0 ? dist[j - 1].S : d.S * d.S / dist[j + 1].S;
    const hi = j < dist.length - 1 ? dist[j + 1].S : d.S * d.S / dist[j - 1].S;
    return { S: d.S, f: d.prob / ((hi - lo) / 2) };
  }).filter((d) => d.S > X[0] && d.S < X[1]);
  const curve = Array.from({ length: 201 }, (_, i) => X[0] + i).map((x) => [x, lognormalPdf(x, { S0: 100, mu: DEFAULTS.r, sigma: DEFAULTS.sigma, T: 1 })] as [number, number]);
  const yMax = 0.03;

  const top = (
    <PlotFrame
      x={X}
      y={[0, yMax]}
      height={230}
      xTicks={[50, 100, 150, 200]}
      yTicks={[0, 0.01, 0.02, 0.03]}
      formatX={(v) => `$${v}`}
      formatY={(v) => (v === 0 ? '0' : v.toFixed(2))}
      xLabel={<>stock price at expiry <Sub base="S" sub="T" /></>}
      yLabel="probability density (risk-neutral)"
    >
      <Polyline points={curve} color="var(--c-vol)" weight={2.5} fillOpacity={0} />
      {n <= 40
        ? density.map((d) => <Line.Segment key={d.S} point1={[d.S, 0]} point2={[d.S, Math.min(d.f, yMax)]} color="var(--c-prob)" weight={Math.max(3, 14 - n / 3)} opacity={0.65} />)
        : <Polyline points={density.map((d) => [d.S, Math.min(d.f, yMax)] as [number, number])} color="var(--c-prob)" weight={2} fillOpacity={0} />}
      <Label x={175} y={0.012} attach="e" attachDistance={0} size={12} color="var(--c-vol)">lognormal</Label>
    </PlotFrame>
  );

  const bottom = (
    <div style={{ borderTop: '1px solid var(--border)' }}>
      <PlotFrame
        x={[0, MAX_N]}
        y={[bs - 1.2, bs + 1.2]}
        height={210}
        xTicks={[0, 50, 100, 150, 200]}
        yTicks={[9.5, 10, 10.5, 11, 11.5].filter((v) => v > bs - 1.2 && v < bs + 1.2)}
        formatX={(v) => String(v)}
        formatY={(v) => `$${v.toFixed(1)}`}
        xLabel="number of steps n"
        yLabel="tree price of the call"
      >
        <Line.Segment point1={[0, bs]} point2={[MAX_N, bs]} color="var(--c-call)" style="dashed" weight={2} />
        <Label x={MAX_N} y={bs} attach="nw" attachDistance={6} size={12} color="var(--c-call)">Black–Scholes {money(bs)}</Label>
        <Polyline points={prices.map((v, i) => [i + 1, v] as [number, number])} color="var(--text-muted)" weight={1.5} fillOpacity={0} />
        <Point x={n} y={prices[n - 1]} color="var(--c-spot)" />
      </PlotFrame>
    </div>
  );

  const err = prices[n - 1] - bs;
  return (
    <WidgetFrame
      title="From trees to Black–Scholes"
      ariaLabel={`With ${n} steps, the tree prices the call at ${money(prices[n - 1])}, ${signedMoney(err)} from Black–Scholes.`}
      plotHeight={440}
      plot={<>{top}{bottom}</>}
      controls={<Slider label="Number of steps $n$" value={n} min={1} max={MAX_N} onChange={setN} format={(v) => String(v)} color="var(--c-time)" />}
      readout={
        <dl className="readout-grid">
          <dt>Tree price ({n} steps)</dt><dd>{money(prices[n - 1])}</dd>
          <dt>Black–Scholes</dt><dd style={{ color: 'var(--c-call)' }}>{money(bs)}</dd>
          <dt>Error</dt><dd>{signedMoney(err, 4)}</dd>
          <dt>Terminal prices</dt><dd>{n + 1} possible values</dd>
        </dl>
      }
      caption="One-year call, strike \$100, rate 5%, volatility 20%. Top: the tree's possible stock prices at expiry, as a density (grey), against the lognormal (purple). Bottom: the tree's price for every n up to 200."
    />
  );
}
