import { Polygon, Polyline } from 'mafs';
import { useMemo, useState } from 'react';
import { PIN, closeHistogram, localMultiplier, pinShare, simulatePinning } from '../../lib/feedback/pinning';
import { Button, Slider } from '../ui/controls';
import { WidgetFrame } from '../ui/WidgetFrame';
import { Label, PlotFrame } from './PlotFrame';

const PATHS = 1500;
const LO = -5, HI = 5, BINS = 40;
const W = (HI - LO) / BINS;
const SPOTS = Array.from({ length: 161 }, (_, i) => 96 + i * 0.05);
const HORIZONS = [
  { days: 5, label: '5 days' },
  { days: 1, label: '1 day' },
  { days: 1 / 6.5, label: '1 hour' },
  { days: 1 / 78, label: '5 minutes' },
];
const OPACITY = [0.35, 0.55, 0.8, 1];

interface PinningHistogramProps {
  title?: string;
  initialContracts?: number;
}

/**
 * Chapter 67: pinning. Top: the stock's local-volatility multiplier near the
 * strike at several times before expiry, when hedgers hold the chosen position.
 * Bottom: where the stock closes on expiry day, relative to the strike, over
 * many seeded paths of the last five days, with and without hedging feedback.
 */
export default function PinningHistogram({ title = 'Pinned to the strike', initialContracts = 50000 }: PinningHistogramProps) {
  const [contracts, setContracts] = useState(initialContracts);
  const [impact, setImpact] = useState(0.4);
  const [seed, setSeed] = useState(67);
  const lambda = (impact / 100) * PIN.K / 1e6;
  const sim = useMemo(() => simulatePinning({ paths: PATHS, seed, contracts, lambda }), [seed, contracts, lambda]);
  const hFree = closeHistogram(sim.free, LO, HI, BINS), hHedged = closeHistogram(sim.hedged, LO, HI, BINS);
  const hMax = Math.max(0.06, ...hFree, ...hHedged) * 1.2;
  const yTop = 1.25;

  const top = (
    <PlotFrame x={[96, 104]} y={[0, yTop]} height={170} xTicks={[96, 98, 100, 102, 104]} yTicks={[0, 0.5, 1]} formatX={(v) => `$${v}`} formatY={(v) => `${v}×`} yLabel="volatility multiplier" marginLeft={40}>
      {HORIZONS.map((h, i) => (
        <Polyline key={h.label} points={SPOTS.map((S) => [S, Math.min(localMultiplier(S, h.days / 252, contracts, lambda), yTop)] as [number, number])} color="var(--c-vol)" weight={2} strokeOpacity={OPACITY[i]} fillOpacity={0} />
      ))}
      <Label x={100} y={Math.min(localMultiplier(100, 1 / 78 / 252, contracts, lambda), yTop - 0.1)} attach={contracts >= 0 ? 's' : 'n'} attachDistance={6} size={11} color="var(--c-vol)">5 minutes left</Label>
      <Label x={103.9} y={Math.min(localMultiplier(103.9, 5 / 252, contracts, lambda), yTop - 0.1)} attach="sw" attachDistance={4} size={11} color="var(--c-vol)">5 days left</Label>
    </PlotFrame>
  );

  const step = (h: number[]) => h.flatMap((d, i) => [[LO + i * W, d], [LO + (i + 1) * W, d]] as [number, number][]);
  const bottom = (
    <div style={{ borderTop: '1px solid var(--border)' }}>
      <PlotFrame x={[LO, HI]} y={[0, hMax]} height={200} xTicks={[-4, -2, 0, 2, 4]} yTicks={[]} formatX={(v) => (v === 0 ? 'strike' : `${v > 0 ? '+' : '−'}$${Math.abs(v)}`)} xLabel="closing price minus the strike" yLabel="share of expiry days" marginLeft={16}>
        <Polygon points={[[LO, 0], ...step(hHedged), [HI, 0]]} color="var(--c-spot)" fillOpacity={0.4} strokeOpacity={0} />
        <Polyline points={step(hHedged)} color="var(--c-spot)" weight={2} fillOpacity={0} />
        <Polyline points={step(hFree)} color="var(--text-muted)" weight={1.5} strokeStyle="dashed" fillOpacity={0} />
      </PlotFrame>
    </div>
  );

  const f = pinShare(sim.free, 0.25), h = pinShare(sim.hedged, 0.25);
  const side = contracts > 0 ? 'long' : contracts < 0 ? 'short' : 'flat';
  return (
    <WidgetFrame
      title={title}
      ariaLabel={`With hedgers ${side} ${Math.abs(contracts).toLocaleString('en-US')} contracts at the $100 strike, ${(h * 100).toFixed(1)}% of expiries close within 25 cents of the strike, against ${(f * 100).toFixed(1)}% without hedging feedback.`}
      plotHeight={370}
      plot={<>{top}{bottom}</>}
      controls={
        <>
          <Slider label="Hedgers' position at the \$100 strike" value={contracts} min={-50000} max={100000} step={5000} onChange={setContracts} format={(v) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v / 1000)}k contracts`} color="var(--c-vol)" />
          <Slider label="Price impact of 1 million shares" value={impact} min={0} max={1} step={0.05} onChange={setImpact} format={(v) => `${v.toFixed(2)}%`} />
          <Button onClick={() => setSeed((s) => s + 1)}>Re-simulate</Button>
        </>
      }
      readout={
        <dl className="readout-grid">
          <dt>Within 25¢ of the strike</dt><dd>{(h * 100).toFixed(1)}% <span className="muted">of closes with hedging, against {(f * 100).toFixed(1)}% without</span></dd>
          <dt>Last 5 minutes</dt><dd>volatility at the strike × {localMultiplier(100, 1 / 78 / 252, contracts, lambda).toFixed(2)}</dd>
        </dl>
      }
      caption={`The last five trading days before expiry of a \\$100 stock with 20% volatility, starting within \\$2 of the strike, on ${PATHS.toLocaleString('en-US')} seeded paths. Positive positions: hedgers long the options, so long gamma; negative: short. Top: how much hedging scales the stock's volatility near the strike, from five days (faint) to five minutes (solid) before the close. Bottom: closing prices with hedging feedback (blue) and without (dashed).`}
    />
  );
}
