import { Line, Polygon } from 'mafs';
import { useMemo, useState } from 'react';
import { chainLiquidity, type TickRule } from '../../lib/micro/liquidity';
import { Segmented } from '../ui/controls';
import { WidgetFrame } from '../ui/WidgetFrame';
import { Label, PlotFrame } from './PlotFrame';

type Unit = 'dollars' | 'percent' | 'vol';
type Expiry = '1m' | '3m';
const STRIKES = Array.from({ length: 13 }, (_, i) => 70 + 5 * i);
const HEIGHT = 270;
const UNITS: Record<Unit, { cap: number; ticks: number[]; fmt: (v: number) => string; label: string }> = {
  dollars: { cap: 0.4, ticks: [0, 0.1, 0.2, 0.3, 0.4], fmt: (v) => `$${v.toFixed(2)}`, label: 'spread, $ per share' },
  percent: { cap: 2, ticks: [0, 0.5, 1, 1.5, 2], fmt: (v) => `${Math.round(v * 100)}%`, label: 'spread, % of the mid' },
  vol: { cap: 6, ticks: [0, 2, 4, 6], fmt: (v) => `${v.toFixed(v < 10 ? 1 : 0)}`, label: 'spread, volatility points' },
};

/**
 * Chapter 47: bid–ask spreads of out-of-the-money options across strikes, in
 * dollars, as a percentage of the price, and in volatility points. Quotes come
 * from a market maker charging for handling, vega risk and delta hedging,
 * rounded to the tick grid.
 */
interface ChainLiquidityProps {
  title?: string;
  initialUnit?: Unit;
  initialExpiry?: Expiry;
}

export default function ChainLiquidity({ title = 'Spreads across the chain', initialUnit = 'dollars', initialExpiry = '3m' }: ChainLiquidityProps) {
  const [unit, setUnit] = useState<Unit>(initialUnit);
  const [expiry, setExpiry] = useState<Expiry>(initialExpiry);
  const [rule, setRule] = useState<TickRule>('standard');
  const rows = useMemo(() => chainLiquidity(expiry === '1m' ? 1 / 12 : 0.25, STRIKES, rule), [expiry, rule]);
  const u = UNITS[unit];
  const valueOf = (r: (typeof rows)[number]) => (unit === 'dollars' ? r.spread : unit === 'percent' ? r.spreadPct : r.spreadVol);
  const pick = [80, 100, 120].map((k) => rows.find((r) => r.strike === k)!);
  const F = 100 * Math.exp(0.05 * (expiry === '1m' ? 1 / 12 : 0.25));

  const plot = (
    <PlotFrame x={[66, 134]} y={[0, u.cap * 1.3]} height={HEIGHT} xTicks={[70, 80, 90, 100, 110, 120, 130]} yTicks={u.ticks} formatX={(v) => `$${v}`} formatY={u.fmt} xLabel="strike" yLabel={u.label} marginLeft={46}>
      {rows.map((r) => {
        const v = valueOf(r);
        const h = Math.min(v, u.cap * 1.05);
        const color = r.type === 'put' ? 'var(--c-put)' : 'var(--c-call)';
        return (
          <g key={r.strike}>
            <Polygon points={[[r.strike - 1.6, 0], [r.strike + 1.6, 0], [r.strike + 1.6, h], [r.strike - 1.6, h]]} color={color} fillOpacity={0.6} strokeOpacity={0.9} weight={1} />
            {v > u.cap && <Label x={r.strike} y={h} attach="n" attachDistance={3} size={10} color="var(--text-muted)">{r.bid === 0 ? '0 bid' : '↑'}</Label>}
          </g>
        );
      })}
      <Line.Segment point1={[F, 0]} point2={[F, u.cap * 1.3]} color="var(--c-spot)" style="dashed" weight={1} />
      <Label x={F} y={u.cap * 1.28} attach="se" attachDistance={4} size={11} color="var(--c-spot)">forward</Label>
    </PlotFrame>
  );

  return (
    <WidgetFrame
      title={title}
      ariaLabel={`Bid–ask spreads of out-of-the-money options in ${unit}: at the money the spread is $${pick[1].spread.toFixed(2)}, ${Math.round(pick[1].spreadPct * 100)}% of the price, ${pick[1].spreadVol.toFixed(1)} volatility points.`}
      plotHeight={HEIGHT}
      plot={plot}
      controls={
        <>
          <Segmented label="Units" value={unit} onChange={setUnit} options={[
            { value: 'dollars', label: 'Dollars' },
            { value: 'percent', label: 'Percent' },
            { value: 'vol', label: 'Vol points', color: 'var(--c-vol)' },
          ]} />
          <Segmented label="Expiry" value={expiry} onChange={setExpiry} options={[
            { value: '1m', label: '1 month', color: 'var(--c-time)' },
            { value: '3m', label: '3 months', color: 'var(--c-time)' },
          ]} />
          <Segmented label="Tick size" value={rule} onChange={setRule} options={[
            { value: 'standard', label: '5¢ / 10¢ ticks' },
            { value: 'penny', label: '1¢ / 5¢ ticks' },
          ]} />
        </>
      }
      readout={
        <table className="iter-table">
          <thead>
            <tr><th style={{ textAlign: 'left' }}>Option</th><th>Bid / ask</th><th>$</th><th>%</th><th>Vol pts</th></tr>
          </thead>
          <tbody>
            {pick.map((r) => (
              <tr key={r.strike}>
                <td style={{ textAlign: 'left', color: r.type === 'put' ? 'var(--c-put)' : 'var(--c-call)' }}>{r.strike} {r.type}</td>
                <td>{r.bid.toFixed(2)} / {r.ask.toFixed(2)}</td>
                <td>{r.spread.toFixed(2)}</td>
                <td>{Math.round(r.spreadPct * 100)}%</td>
                <td>{r.spreadVol > 99 ? '>99' : r.spreadVol.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      }
      caption="Out-of-the-money options on a skewed smile, stock at \$100: puts (red) below the forward, calls (green) above it. Each quote is the option's value plus or minus a half-spread that pays for handling (1¢), for vega risk (0.4 volatility points) and for hedging delta, rounded outwards to the tick grid."
    />
  );
}
