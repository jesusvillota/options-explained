import { Line, Polyline } from 'mafs';
import { useMemo, useState } from 'react';
import { limitOrderCost } from '../../lib/exec/algos';
import { Slider } from '../ui/controls';
import { WidgetFrame } from '../ui/WidgetFrame';
import { niceTicks } from './format';
import { Label, PlotFrame } from './PlotFrame';

const SIGMA = 200 / Math.sqrt(390); // bp per √minute: 2% daily volatility
const H_MAX = 30;
const HS = Array.from({ length: 61 }, (_, i) => Math.max((i * H_MAX) / 60, 0.05));
const DEPTHS = [0, 5, 10]; // bp below the best bid
const STYLES = [
  { color: 'var(--c-bid)', style: 'solid' as const, weight: 3 },
  { color: 'var(--c-bid)', style: 'dashed' as const, weight: 2 },
  { color: 'var(--text-muted)', style: 'dashed' as const, weight: 1.5 },
];
const depthName = (d: number) => (d === 0 ? 'at the bid' : `${d} bp below the bid`);

interface LimitVsMarketProps {
  title?: string;
  initialDrift?: number;
}

/**
 * Chapter 64: post a limit order and wait, or pay the spread now? A buy limit
 * order at (or below) the bid fills if the mid falls to it within the waiting
 * time; otherwise the buyer pays the ask at the deadline. Top: expected cost
 * against the arrival mid for each waiting time. Bottom: fill probability.
 */
export default function LimitVsMarket({ title = 'Limit order or market order?', initialDrift = 1 }: LimitVsMarketProps) {
  const [spread, setSpread] = useState(10);
  const [mu, setMu] = useState(initialDrift);
  const curves = useMemo(() => DEPTHS.map((d) => HS.map((h) => ({ h, ...limitOrderCost(spread / 2 + d, spread, mu, SIGMA, h) }))), [spread, mu]);
  const best = curves[0].reduce((a, c) => (c.cost < a.cost ? c : a));
  const market = spread / 2;
  const yMax = Math.max(market * 2, Math.min(Math.max(...curves.flat().map((c) => c.cost)), market * 4)) * 1.1;

  const top = (
    <PlotFrame x={[0, H_MAX]} y={[0, yMax]} height={210} xTicks={[0, 5, 10, 15, 20, 25, 30]} yTicks={niceTicks(0, yMax, 4)} formatX={(v) => `${v}m`} formatY={(v) => `${v} bp`} yLabel="expected cost against the arrival mid" marginLeft={44}>
      <Line.Segment point1={[0, market]} point2={[H_MAX, market]} color="var(--c-ask)" weight={2.5} />
      <Label x={H_MAX} y={market} attach="sw" attachDistance={4} size={11} color="var(--c-ask)">market order: half the spread</Label>
      {curves.map((c, i) => (
        <Polyline key={i} points={c.map((p) => [p.h, Math.min(p.cost, yMax)] as [number, number])} color={STYLES[i].color} weight={STYLES[i].weight} strokeStyle={STYLES[i].style} fillOpacity={0} />
      ))}
      <Line.Segment point1={[best.h, 0]} point2={[best.h, best.cost]} color="var(--c-bid)" weight={1} style="dashed" />
    </PlotFrame>
  );
  const bottom = (
    <div style={{ borderTop: '1px solid var(--border)' }}>
      <PlotFrame x={[0, H_MAX]} y={[0, 1.1]} height={140} xTicks={[0, 5, 10, 15, 20, 25, 30]} yTicks={[0, 0.5, 1]} formatX={(v) => `${v}m`} formatY={(v) => `${v * 100}%`} xLabel="how long you wait before paying the ask" yLabel="chance of a fill" marginLeft={44}>
        {curves.map((c, i) => (
          <Polyline key={i} points={c.map((p) => [p.h, p.fill] as [number, number])} color={STYLES[i].color} weight={STYLES[i].weight} strokeStyle={STYLES[i].style} fillOpacity={0} />
        ))}
      </PlotFrame>
    </div>
  );

  const verdict = best.cost < market ? `limit at the bid, wait ${best.h.toFixed(1)} min` : 'market order';
  return (
    <WidgetFrame
      title={title}
      ariaLabel={`With a ${spread} bp spread and the price drifting up ${mu} bp a minute, the best plan is a ${verdict}, with expected cost ${Math.min(best.cost, market).toFixed(2)} bp.`}
      plotHeight={350}
      plot={<>{top}{bottom}</>}
      controls={
        <>
          <Slider label="Bid–ask spread" value={spread} min={2} max={20} step={1} onChange={setSpread} format={(v) => `${v} bp`} />
          <Slider label="Drift against you $\mu$" value={mu} min={0} max={4} step={0.1} onChange={setMu} format={(v) => `${v.toFixed(1)} bp/min`} color="var(--c-ask)" />
        </>
      }
      readout={
        <dl className="readout-grid">
          <dt>Market order</dt><dd>{market.toFixed(2)} bp</dd>
          <dt>Best limit order</dt>
          {best.cost < market
            ? <dd>{best.cost.toFixed(2)} bp <span className="muted">at the bid, giving up after {best.h.toFixed(1)} min; fills {(best.fill * 100).toFixed(0)}% of the time</span></dd>
            : <dd>none beats the market order <span className="muted">(the drift outruns the spread saved)</span></dd>}
          <dt>Choose</dt><dd>{verdict}</dd>
        </dl>
      }
      caption={`Buying a small amount of a stock with 2% daily volatility. The limit order fills if the mid falls to its price; if it hasn't filled by the deadline, the buyer cancels and pays the ask. Lines: posting ${DEPTHS.map(depthName).join(', ')}. Drift is the expected rise in the price while you wait: the cost of urgency or of trading against informed flow.`}
    />
  );
}
