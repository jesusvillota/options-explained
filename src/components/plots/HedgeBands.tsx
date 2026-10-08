import { Point, Polyline } from 'mafs';
import { useMemo, useState } from 'react';
import { lelandVol, simulateCostHedge } from '../../lib/mm/transactionCosts';
import { price } from '../../lib/pricing/blackScholes';
import { Button, Slider } from '../ui/controls';
import { WidgetFrame } from '../ui/WidgetFrame';
import { money, niceTicks } from './format';
import { Label, PlotFrame } from './PlotFrame';

const MULTIPLIER = 100;
const PATHS = 200;
const BASE = { S0: 100, K: 100, T: 0.25, r: 0.05, sigma: 0.2 };
const STEPS = [6, 13, 26, 63, 126, 252];
const AVERSIONS = [0.1, 0.3, 1, 3, 10, 30];
const HEIGHT = 300;

/**
 * Chapter 59: the trade-off between hedging error and trading cost for a sold
 * three-month at-the-money call. Each point is one hedging rule: rebalancing on
 * a fixed schedule (from 6 times to 252 times over the option's life), or
 * trading only when the hedge leaves a Whalley–Wilmott band (from loose to
 * tight). Down and to the left is better.
 */
export default function HedgeBands({ title = 'Hedging by the clock or by the band' }: { title?: string }) {
  const [eps, setEps] = useState(0.002);
  const [seed, setSeed] = useState(59);
  const pts = useMemo(() => ({
    time: STEPS.map((n) => ({ n, r: simulateCostHedge({ ...BASE, eps, paths: PATHS, seed, mode: 'time', steps: n }) })),
    band: AVERSIONS.map((g) => ({ g, r: simulateCostHedge({ ...BASE, eps, paths: PATHS, seed, mode: 'band', steps: 252, riskAversion: g }) })),
  }), [eps, seed]);
  const xy = (r: { meanCost: number; sdPnl: number }) => [r.meanCost * MULTIPLIER, r.sdPnl * MULTIPLIER] as [number, number];
  const all = [...pts.time, ...pts.band].map((p) => xy(p.r));
  const xMax = Math.max(...all.map((a) => a[0])) * 1.15, yMax = Math.max(...all.map((a) => a[1])) * 1.15;
  const opt = { S: BASE.S0, K: BASE.K, T: BASE.T, r: BASE.r, sigma: BASE.sigma };
  const bs = price('call', opt);
  const leland = (n: number) => price('call', { ...opt, sigma: lelandVol(BASE.sigma, eps, BASE.T / n) });

  const plot = (
    <PlotFrame x={[0, xMax]} y={[0, yMax]} height={HEIGHT} xTicks={niceTicks(0, xMax, 5)} yTicks={niceTicks(0, yMax, 4)} formatX={(v) => `$${v}`} formatY={(v) => `$${v}`} xLabel="expected trading cost per contract" yLabel="standard deviation of P&L per contract" marginLeft={48}>
      <Polyline points={pts.time.map((p) => xy(p.r))} color="var(--text-muted)" weight={2} strokeStyle="dashed" fillOpacity={0} />
      <Polyline points={pts.band.map((p) => xy(p.r))} color="var(--c-call)" weight={2.5} fillOpacity={0} />
      {pts.time.map((p) => (
        <g key={`t${p.n}`}>
          <Point x={xy(p.r)[0]} y={xy(p.r)[1]} color="var(--text-muted)" />
          <Label x={xy(p.r)[0]} y={xy(p.r)[1]} attach="ne" attachDistance={5} size={10} color="var(--text-muted)">{`${p.n}×`}</Label>
        </g>
      ))}
      {pts.band.map((p) => (
        <g key={`b${p.g}`}>
          <Point x={xy(p.r)[0]} y={xy(p.r)[1]} color="var(--c-call)" />
          <Label x={xy(p.r)[0]} y={xy(p.r)[1]} attach="sw" attachDistance={5} size={10} color="var(--c-call)">{`γ ${p.g}`}</Label>
        </g>
      ))}
    </PlotFrame>
  );

  return (
    <WidgetFrame
      title={title}
      ariaLabel={`With a cost of ${(eps * 100).toFixed(2)}% per trade, band hedging reaches the same risk as clock hedging at a lower cost.`}
      plotHeight={HEIGHT}
      plot={plot}
      controls={
        <>
          <Slider label="Trading cost $\epsilon$ (one way, % of value)" value={eps} min={0.0005} max={0.005} step={0.0005} onChange={setEps} format={(v) => `${(v * 100).toFixed(2)}%`} color="var(--c-rate)" />
          <Button onClick={() => setSeed((s) => s + 1)}>Re-simulate</Button>
        </>
      }
      readout={
        <dl className="readout-grid">
          <dt>Black–Scholes</dt><dd>{money(bs * MULTIPLIER)} per contract at 20% volatility</dd>
          <dt>Leland, weekly</dt><dd>{money(leland(13) * MULTIPLIER)} <span className="muted">(σ_L = {(lelandVol(0.2, eps, BASE.T / 13) * 100).toFixed(1)}%)</span></dd>
          <dt>Leland, daily</dt><dd>{money(leland(63) * MULTIPLIER)} <span className="muted">(σ_L = {(lelandVol(0.2, eps, BASE.T / 63) * 100).toFixed(1)}%)</span></dd>
        </dl>
      }
      caption={`A three-month at-the-money call on the \\$100 stock (20% volatility), sold at its Black–Scholes value and delta-hedged on ${PATHS} simulated paths. Grey: rebalancing a fixed number of times over the option's life. Green: checking four times a day and trading only to the edge of the Whalley–Wilmott band, for risk aversions from 0.1 (loose) to 30 (tight).`}
    />
  );
}
