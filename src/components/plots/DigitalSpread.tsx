import { Line, Polyline } from 'mafs';
import { useState } from 'react';
import { DEFAULTS, greeks } from '../../lib/pricing/blackScholes';
import { callSpreadDigital, callSpreadPayoff, digitalCallDelta, digitalCash } from '../../lib/pricing/exotics';
import { Slider } from '../ui/controls';
import { WidgetFrame } from '../ui/WidgetFrame';
import { money } from './format';
import { Label, PlotFrame } from './PlotFrame';

const K = 100;
const days = (t: number) => { const d = Math.max(Math.round(t * 365), 1); return `${d} day${d === 1 ? '' : 's'}`; };
const X0 = 70, X1 = 130;

/**
 * Chapter 37: a digital call (pays $1 above the strike) and the call spread
 * that replicates it. Top: payoffs at expiry. Bottom: deltas today, for the
 * chosen time to expiry. As the spread narrows and expiry nears, the delta
 * concentrates into a spike at the strike: pin risk.
 */
export default function DigitalSpread() {
  const [h, setH] = useState(10);
  const [tau, setTau] = useState(0.1);
  const input = { ...DEFAULTS, T: tau };
  const xs = Array.from({ length: 241 }, (_, i) => X0 + ((X1 - X0) * i) / 240);
  const spreadDelta = (S: number) => (greeks('call', { ...input, S, K: K - h / 2 }).delta - greeks('call', { ...input, S, K: K + h / 2 }).delta) / h;
  const digDelta = (S: number) => digitalCallDelta({ ...input, S, K });
  const deltas = xs.map((S) => [S, spreadDelta(S)] as [number, number]);
  const digital = xs.map((S) => [S, digDelta(S)] as [number, number]);
  const dMax = Math.max(...digital.map(([, d]) => d), ...deltas.map(([, d]) => d)) * 1.15;
  const spreadPrice = callSpreadDigital({ ...input, K }, h);
  const digPrice = digitalCash('call', { ...input, K });

  const payoffs = (
    <PlotFrame x={[X0, X1]} y={[-0.1, 1.25]} height={160} xTicks={[70, 80, 90, 100, 110, 120, 130]} yTicks={[0, 1]} formatX={(v) => `$${v}`} formatY={(v) => money(v, 0)} baseline={0} yLabel="payoff at expiry">
      <Polyline points={[[X0, 0], [K, 0], [K, 1], [X1, 1]]} color="var(--c-call)" weight={2} strokeStyle="dashed" fillOpacity={0} />
      <Polyline points={xs.map((S) => [S, callSpreadPayoff(S, K, h)] as [number, number])} color="var(--c-strike)" weight={3} fillOpacity={0} />
      <Label x={K + 1} y={0.45} attach="e" size={12} color="var(--c-call)">digital: $1 above K</Label>
      <Label x={K + h / 2} y={1} attach="se" attachDistance={6} size={12} color="var(--c-strike)">call spread, width {money(h, h < 1 ? 2 : 0)}</Label>
    </PlotFrame>
  );
  const deltaPlot = (
    <div style={{ borderTop: '1px solid var(--border)' }}>
      <PlotFrame x={[X0, X1]} y={[0, dMax]} height={180} xTicks={[70, 80, 90, 100, 110, 120, 130]} yTicks={[]} formatX={(v) => `$${v}`} xLabel="stock price today" yLabel={`delta with ${tau < 0.05 ? days(tau) : `${tau.toFixed(2)} yr`} to go`}>
        <Line.Segment point1={[K, 0]} point2={[K, dMax]} color="var(--c-strike)" style="dashed" weight={1} />
        <Polyline points={digital} color="var(--c-call)" weight={2} strokeStyle="dashed" fillOpacity={0} />
        <Polyline points={deltas} color="var(--c-strike)" weight={3} fillOpacity={0} />
      </PlotFrame>
    </div>
  );

  return (
    <WidgetFrame
      title="A digital is a very narrow call spread"
      ariaLabel={`Call spread of width ${h} around 100 worth ${money(spreadPrice, 4)} against a digital worth ${money(digPrice, 4)}; peak digital delta ${dMax.toFixed(2)} per dollar.`}
      plotHeight={340}
      plot={<>{payoffs}{deltaPlot}</>}
      controls={
        <>
          <Slider label="Spread width h" value={h} min={0.5} max={20} step={0.5} onChange={setH} format={(v) => money(v, 2)} color="var(--c-strike)" />
          <Slider label="Time to expiry $\Time{\tau}$" value={tau} min={0.003} max={1} step={0.001} onChange={setTau} format={(v) => (v < 0.05 ? days(v) : `${v.toFixed(2)} yr`)} color="var(--c-time)" />
        </>
      }
      readout={
        <dl className="readout-grid">
          <dt>Call spread (1/h calls each side)</dt><dd>{money(spreadPrice, 4)}</dd>
          <dt>Digital, e^(−rτ)N(d₂)</dt><dd>{money(digPrice, 4)}</dd>
          <dt>Peak delta of the digital</dt><dd>{Math.max(...digital.map(([, d]) => d)).toFixed(3)} shares per $1 of digital payout</dd>
        </dl>
      }
      caption="Strike \$100, $\Vol{\sigma} = 20\%$, $\Rate{r} = 5\%$. Dashed: the digital; solid: the call spread. Near expiry the digital's delta becomes a narrow, tall spike at the strike: a hedger must trade a lot of stock on tiny moves."
    />
  );
}
