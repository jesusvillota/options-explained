import { Line, Polygon } from 'mafs';
import { useMemo, useState } from 'react';
import { VOL_STRIKES, volTradePlan, type Allocation, type Method } from '../../lib/exec/optionExecution';
import { Segmented, Slider } from '../ui/controls';
import { WidgetFrame } from '../ui/WidgetFrame';
import { money, niceTicks, signedMoney } from './format';
import { Label, PlotFrame } from './PlotFrame';

const X: [number, number] = [86.5, 113.5];
const ALLOCATIONS: { value: Allocation; label: string }[] = [
  { value: 'atm', label: 'At the money' },
  { value: 'even', label: 'Evenly' },
  { value: 'liquidity', label: 'By liquidity' },
];
const METHODS: { value: Method; label: string }[] = [
  { value: 'screen', label: 'Lift offers' },
  { value: 'work', label: 'Work the order' },
  { value: 'rfq', label: 'Request a quote' },
];

const bar = (K: number, lo: number, hi: number, w = 1.6): [number, number][] => [[K - w, lo], [K + w, lo], [K + w, hi], [K - w, hi]];

interface VolTradeExecutionProps {
  title?: string;
  initialMethod?: Method;
}

/**
 * Chapter 65: buying a vega notional across strikes. Top: vega bought at each
 * strike. Bottom: the entry cost at each strike in vol points, split into the
 * spread paid and the impact. The readout turns the costs into the realised
 * volatility a long-vol trade needs to break even.
 */
export default function VolTradeExecution({ title = 'Executing a volatility trade', initialMethod = 'screen' }: VolTradeExecutionProps) {
  const [Q, setQ] = useState(50000);
  const [allocation, setAllocation] = useState<Allocation>('atm');
  const [method, setMethod] = useState<Method>(initialMethod);
  const [edge, setEdge] = useState(1.5);
  const plan = useMemo(() => volTradePlan({ Q, allocation, method, edge }), [Q, allocation, method, edge]);

  const vMax = Math.max(...plan.legs.map((l) => l.vega)) / 1000 * 1.3;
  const top = (
    <PlotFrame x={X} y={[0, vMax]} height={140} xTicks={VOL_STRIKES} yTicks={niceTicks(0, vMax, 3)} formatX={(v) => `$${v}`} formatY={(v) => (v === 0 ? '$0' : `$${v}k`)} yLabel="vega bought (per vol point)" marginLeft={46}>
      {plan.legs.map((l) => l.vega > 0 && (
        <Polygon key={l.strike} points={bar(l.strike, 0, l.vega / 1000)} color="var(--c-vol)" fillOpacity={0.6} strokeOpacity={0.9} weight={1} />
      ))}
    </PlotFrame>
  );

  const cMax = Math.max(1.2, ...plan.legs.map((l) => (l.vega > 0 ? l.spread + l.impact : 0))) * 1.3;
  const bottom = (
    <div style={{ borderTop: '1px solid var(--border)' }}>
      <PlotFrame x={X} y={[0, cMax]} height={190} xTicks={VOL_STRIKES} yTicks={niceTicks(0, cMax, 4)} formatX={(v) => `$${v}`} formatY={(v) => v.toFixed(1)} xLabel="strike (puts below $100, calls from $100)" yLabel="entry cost (vol points)" marginLeft={46}>
        {plan.legs.map((l) => l.vega > 0 && (
          <g key={l.strike}>
            <Polygon points={bar(l.strike, 0, l.spread)} color="var(--c-ask)" fillOpacity={0.7} strokeOpacity={0.9} weight={1} />
            <Polygon points={bar(l.strike, l.spread, l.spread + l.impact)} color="var(--c-ask)" fillOpacity={0.25} strokeOpacity={0.9} weight={1} />
          </g>
        ))}
        <Line.Segment point1={[X[0], plan.entryVol]} point2={[X[1], plan.entryVol]} color="var(--text)" weight={1.5} style="dashed" />
        <Label x={X[1]} y={plan.entryVol} attach="nw" attachDistance={4} size={11} color="var(--text)">{`average ${plan.entryVol.toFixed(2)}`}</Label>
      </PlotFrame>
    </div>
  );

  return (
    <WidgetFrame
      title={title}
      ariaLabel={`Buying $${Q.toLocaleString('en-US')} of vega costs ${plan.entryVol.toFixed(2)} vol points to enter; a long-volatility trade needs realised volatility ${plan.breakevenVol.toFixed(2)} points above implied to break even.`}
      plotHeight={330}
      plot={<>{top}{bottom}</>}
      controls={
        <>
          <Slider label="Vega to buy (per vol point)" value={Q} min={5000} max={100000} step={5000} onChange={setQ} format={(v) => `$${(v / 1000).toFixed(0)}k`} color="var(--c-vol)" />
          <Slider label="Your edge (vol points)" value={edge} min={0} max={3} step={0.1} onChange={setEdge} format={(v) => `${v.toFixed(1)} pts`} color="var(--c-vol)" />
          <Segmented label="Where to buy" value={allocation} onChange={setAllocation} options={ALLOCATIONS} />
          <Segmented label="How to buy" value={method} onChange={setMethod} options={METHODS} />
        </>
      }
      readout={
        <dl className="readout-grid">
          <dt>Entry cost</dt><dd>{money(plan.entryDollars, 0)} <span className="muted">= {plan.entryVol.toFixed(2)} vol points</span></dd>
          <dt>Breakeven</dt><dd>{plan.breakevenVol.toFixed(2)} vol points <span className="muted">round trip {plan.roundTripVol.toFixed(2)} + hedging {plan.hedgeVol.toFixed(2)}</span></dd>
          <dt>Expected P&amp;L</dt><dd>{signedMoney(plan.expectedPnl, 0)} <span className="muted">with a {edge.toFixed(1)}-point edge</span></dd>
        </dl>
      }
      caption="Three-month options on the \$100 stock, out of the money (puts below \$100, calls from \$100), quoted as in Chapter 47. Solid bars: half the bid–ask spread, in vol points. Faded bars: impact, a square-root law in the vega bought against each strike's daily traded vega; when you request a quote, a dealer's warehousing charge instead. Your edge is your forecast of realised volatility minus implied. Breakeven adds an exit at the same cost and daily delta hedging at 2 bp a trade."
    />
  );
}
