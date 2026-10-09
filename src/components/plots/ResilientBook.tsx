import { Line, Polygon, Polyline } from 'mafs';
import { Fragment, useMemo, useState } from 'react';
import { blockSchedule, dentPath, obizhaevaWang, optimalSchedule, scheduleCost, tradeTimes, twapSchedule } from '../../lib/exec/transientImpact';
import { Segmented, Slider } from '../ui/controls';
import { WidgetFrame } from '../ui/WidgetFrame';
import { money, niceTicks } from './format';
import { PlotFrame } from './PlotFrame';

const X = 100000; // shares to buy
const T = 60; // minutes
const N = 60; // one trade a minute, plus one at the end
const Q = 500000; // book depth: shares per dollar (5,000 shares per cent)
const T_END = 75;
const STRATEGIES = ['block', 'twap', 'optimal'] as const;
type Strategy = (typeof STRATEGIES)[number];
const NAMES: Record<Strategy, string> = { block: 'All at once', twap: 'Evenly (TWAP)', optimal: 'Optimal' };

interface ResilientBookProps {
  title?: string;
  initialStrategy?: Strategy;
  initialHalfLife?: number;
}

/**
 * Chapter 63: the Obizhaeva–Wang book. Buying eats into a flat book and leaves
 * a dent that refills exponentially. Top: the dent (how far the ask sits above
 * its undisturbed level) over time. Bottom: the size of each trade.
 */
export default function ResilientBook({ title = 'A book that refills', initialStrategy = 'optimal', initialHalfLife = 5 }: ResilientBookProps) {
  const [strategy, setStrategy] = useState<Strategy>(initialStrategy);
  const [halfLife, setHalfLife] = useState(initialHalfLife);
  const rho = Math.LN2 / halfLife;
  const times = useMemo(() => tradeTimes(T, N), []);
  const schedules = useMemo(() => ({
    block: blockSchedule(X, N),
    twap: twapSchedule(X, N),
    optimal: optimalSchedule(X, times, rho),
  }), [rho, times]);
  const costs = Object.fromEntries(STRATEGIES.map((s) => [s, scheduleCost(schedules[s], times, Q, rho)])) as Record<Strategy, number>;
  const trades = schedules[strategy];
  const path = dentPath(trades, times, Q, rho, T_END).map(([t, d]) => [t, d * 100] as [number, number]);
  const ow = obizhaevaWang(X, T, Q, rho);
  const yTop = Math.max(5, Math.ceil(Math.max(...path.map((p) => p[1])) * 1.3));

  const top = (
    <PlotFrame x={[0, T_END]} y={[0, yTop]} height={200} xTicks={[0, 15, 30, 45, 60, 75]} yTicks={niceTicks(0, yTop, 4)} formatX={(v) => `${v}m`} formatY={(v) => `${v}¢`} xLabel="minutes" yLabel="ask above its undisturbed level" marginLeft={40}>
      <Polygon points={[[0, 0], ...path, [T_END, 0]]} color="var(--c-bid)" fillOpacity={0.18} strokeOpacity={0} />
      <Polyline points={path} color="var(--c-bid)" weight={2.5} fillOpacity={0} />
      <Line.Segment point1={[T, 0]} point2={[T, yTop]} color="var(--text-muted)" weight={1} style="dashed" />
    </PlotFrame>
  );

  const tMax = Math.max(...trades) * 1.5;
  const bottom = (
    <div style={{ borderTop: '1px solid var(--border)' }}>
      <PlotFrame x={[0, T_END]} y={[0, tMax]} height={130} xTicks={[0, 15, 30, 45, 60, 75]} yTicks={niceTicks(0, tMax, 3)} formatX={(v) => `${v}m`} formatY={(v) => (v === 0 ? '0' : `${Number((v / 1000).toFixed(1))}k`)} yLabel="shares bought per trade" marginLeft={40}>
        {trades.map((n, k) => n > 0 && (
          <Polygon key={k} points={[[times[k] - 0.35, 0], [times[k] + 0.35, 0], [times[k] + 0.35, n], [times[k] - 0.35, n]]} color="var(--c-bid)" fillOpacity={0.7} strokeOpacity={0.9} weight={1} />
        ))}
      </PlotFrame>
    </div>
  );

  const line = (s: Strategy) => `${money(costs[s], 0)} (${((costs[s] / X) * 100).toFixed(2)}¢ a share)`;
  return (
    <WidgetFrame
      title={title}
      ariaLabel={`With a book that refills with a half-life of ${halfLife} minutes, buying everything at once costs ${money(costs.block, 0)}, buying evenly ${money(costs.twap, 0)}, and the optimal schedule ${money(costs.optimal, 0)}.`}
      plotHeight={330}
      plot={<>{top}{bottom}</>}
      controls={
        <>
          <Segmented label="Strategy" value={strategy} onChange={setStrategy} options={STRATEGIES.map((s) => ({ value: s, label: NAMES[s] }))} />
          <Slider label="Half-life of the book's refill" value={halfLife} min={0.5} max={30} step={0.5} onChange={setHalfLife} format={(v) => `${v} min`} color="var(--c-bid)" />
        </>
      }
      readout={
        <dl className="readout-grid">
          {STRATEGIES.map((s) => (
            <Fragment key={s}>
              <dt>{s === strategy ? <strong>{NAMES[s]}</strong> : NAMES[s]}</dt>
              <dd>{line(s)}</dd>
            </Fragment>
          ))}
          <dt>Obizhaeva–Wang</dt><dd>{money(ow.cost, 0)} <span className="muted">continuous-time optimum; end blocks of {Math.round(ow.block).toLocaleString('en-US')} shares</span></dd>
        </dl>
      }
      caption="Buying 100,000 shares within an hour, one trade a minute. Above the ask the book holds 5,000 shares per cent of price. Each purchase lifts the ask by eating the book, and the dent refills exponentially. A trade's cost is what it pays above the undisturbed ask. The dashed line marks the deadline. The vertical scale adapts to the strategy."
    />
  );
}
