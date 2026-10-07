import { Line, Polyline } from 'mafs';
import { useState } from 'react';
import { EQUITY_SSVI, ssviVol } from '../../lib/vol/smile';
import { logContractPayoff, strikeSpacings, stripPayoff, fairVariance, vixVariance } from '../../lib/vol/varianceSwap';
import { Segmented, Slider } from '../ui/controls';
import { WidgetFrame } from '../ui/WidgetFrame';
import { Label, PlotFrame } from './PlotFrame';

type Spacing = '25' | '10' | '5' | '2.5';
type SmileKind = 'flat' | 'skew';
const F = 100; // r = q = 0 here, so the forward is the spot
const market = { S: F, K: F, T: 1, r: 0 };
const X0 = 20, X1 = 260;
const HEIGHT = 320;
const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

/**
 * Chapter 28: out-of-the-money puts and calls weighted by ΔK/K² add up to the
 * convex payoff (S − F)/F − ln(S/F), the hedge of a variance swap. Pricing the
 * strip gives the fair variance strike.
 */
export default function LogContractStrip() {
  const [spacing, setSpacing] = useState<Spacing>('10');
  const [lowest, setLowest] = useState(50);
  const [smileKind, setSmileKind] = useState<SmileKind>('flat');
  const dK = Number(spacing);
  const highest = (F * F) / lowest; // symmetric in log-strike
  const down = Math.floor((F - lowest) / dK + 1e-9), up = Math.floor((highest - F) / dK + 1e-9);
  const strikes = Array.from({ length: down + up + 1 }, (_, i) => F + (i - down) * dK);
  const weights = strikeSpacings(strikes).map((d, i) => d / strikes[i] ** 2);
  const smile = smileKind === 'flat' ? () => 0.2 : (k: number) => ssviVol(k, 1, EQUITY_SSVI);

  const xs = Array.from({ length: 241 }, (_, i) => X0 + i);
  const target = xs.map((x) => [x, logContractPayoff(x, F)] as [number, number]);
  const strip = xs.map((x) => [x, stripPayoff(x, F, strikes)] as [number, number]);
  const inside = xs.filter((x) => x >= strikes[0] && x <= strikes[strikes.length - 1]);
  const maxErr = Math.max(...inside.map((x) => Math.abs(stripPayoff(x, F, strikes) - logContractPayoff(x, F))));
  const kVar = vixVariance(market, smile, strikes);
  const exact = fairVariance(market, smile);

  return (
    <WidgetFrame
      title="A strip of options builds the log contract"
      ariaLabel={`${strikes.length} options from ${strikes[0]} to ${strikes[strikes.length - 1].toFixed(0)}, spaced ${dK} apart, weighted by 1 over K squared. Strip variance-swap vol ${pct(Math.sqrt(kVar))}; with every strike ${pct(Math.sqrt(exact))}.`}
      plotHeight={HEIGHT}
      plot={
        <PlotFrame x={[X0, X1]} y={[-0.06, 0.9]} height={HEIGHT} xTicks={[20, 60, 100, 140, 180, 220, 260]} yTicks={[0, 0.2, 0.4, 0.6, 0.8]} formatX={(v) => `$${v}`} formatY={(v) => v.toFixed(1)} baseline={0} xLabel="stock price at expiry" yLabel="payoff">
          {strikes.map((K, i) => (
            <Polyline key={K} points={K < F ? [[X0, weights[i] * (K - X0)], [K, 0], [X1, 0]] : K > F ? [[X0, 0], [K, 0], [X1, weights[i] * (X1 - K)]] : [[X0, 0.5 * weights[i] * (K - X0)], [K, 0], [X1, 0.5 * weights[i] * (X1 - K)]]} color={K < F ? 'var(--c-put)' : K > F ? 'var(--c-call)' : 'var(--c-strike)'} weight={1} strokeOpacity={0.45} fillOpacity={0} />
          ))}
          <Polyline points={target} color="var(--text)" weight={2} strokeStyle="dashed" fillOpacity={0} />
          <Polyline points={strip} color="var(--c-vol)" weight={3.5} fillOpacity={0} />
          <Line.Segment point1={[strikes[0], -0.06]} point2={[strikes[0], 0.9]} color="var(--text-muted)" style="dashed" weight={1} />
          <Line.Segment point1={[strikes[strikes.length - 1], -0.06]} point2={[strikes[strikes.length - 1], 0.9]} color="var(--text-muted)" style="dashed" weight={1} />
          <Label x={X0 + 4} y={logContractPayoff(X0 + 4, F)} attach="e" attachDistance={8} size={12} color="var(--text)">target: (S−F)/F − ln(S/F)</Label>
          <Label x={F} y={0.42} attach="n" size={12} color="var(--c-vol)">strip of {strikes.length} options</Label>
        </PlotFrame>
      }
      controls={
        <>
          <Segmented label="Strike spacing" value={spacing} onChange={setSpacing} options={[
            { value: '25', label: '$25' },
            { value: '10', label: '$10' },
            { value: '5', label: '$5' },
            { value: '2.5', label: '$2.50' },
          ]} />
          <Segmented label="Smile used for prices" value={smileKind} onChange={setSmileKind} options={[
            { value: 'flat', label: 'Flat 20%' },
            { value: 'skew', label: 'Equity skew' },
          ]} />
          <Slider label="Strike range" value={lowest} min={25} max={90} step={5} onChange={setLowest} format={(v) => `$${v} to $${Math.round((F * F) / v)}`} color="var(--c-strike)" />
        </>
      }
      readout={
        <dl className="readout-grid">
          <dt>Largest gap inside the strikes</dt><dd>{maxErr.toFixed(4)}</dd>
          <dt>Variance-swap vol from this strip</dt><dd>{pct(Math.sqrt(Math.max(kVar, 0)))} <span className="muted">(all strikes: {pct(Math.sqrt(exact))}; at the money: 20.0%)</span></dd>
        </dl>
      }
      caption="Forward \$100, one year, zero rates. Faint lines: puts below the forward and calls above, each weighted by $\Delta\Strike{K}/\Strike{K}^2$; at the forward, half a put and half a call. Their sum (thick) tracks the target between the outermost strikes and goes straight outside them."
    />
  );
}
