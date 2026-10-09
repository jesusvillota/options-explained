import { Polygon } from 'mafs';
import { useMemo, useState } from 'react';
import { venueReturns } from '../../lib/info/venue';
import { Segmented, Slider } from '../ui/controls';
import { WidgetFrame } from '../ui/WidgetFrame';
import { niceTicks } from './format';
import { Label, PlotFrame } from './PlotFrame';

type Expiry = '1w' | '1m' | '3m';
const EXPIRIES: Record<Expiry, number> = { '1w': 5 / 252, '1m': 1 / 12, '3m': 0.25 };
const HEIGHT = 280;
const pct = (v: number) => (Math.round(v * 100) === 0 ? '0%' : `${v < 0 ? '−' : '+'}${Math.abs(Math.round(v * 100)).toLocaleString('en-US')}%`);

/**
 * Chapter 53: an insider who knows the stock will jump by J overnight compares
 * the return on each dollar invested in the stock and in options, bought at
 * the ask today and marked at fair value tomorrow.
 */
export default function VenueChoice({ title = 'Where should an insider trade?' }: { title?: string }) {
  const [J, setJ] = useState(0.03);
  const [expiry, setExpiry] = useState<Expiry>('1m');
  const strikes = J >= 0 ? [95, 100, 105, 110, 115, 120, 125] : [75, 80, 85, 90, 95, 100, 105];
  const rows = useMemo(() => venueReturns(J, EXPIRIES[expiry], strikes), [J, expiry]);
  const best = rows.reduce((a, b) => (b.ret > a.ret ? b : a));
  const cap = Math.max(1, ...rows.map((r) => r.ret)) * 1.35;
  const yLo = -1.3;
  const color = (t: string) => (t === 'stock' ? 'var(--c-spot)' : t === 'call' ? 'var(--c-call)' : 'var(--c-put)');

  const plot = (
    <PlotFrame x={[-0.6, rows.length - 0.4]} y={[yLo, cap]} height={HEIGHT} xTicks={[]} yTicks={niceTicks(-1, cap, 5)} formatY={(v) => pct(v)} baseline={0} yLabel="return on each $1 invested, by tomorrow" marginLeft={54}>
      {rows.map((r, i) => {
        const h = Math.max(Math.min(r.ret, cap), yLo);
        return (
          <g key={r.label}>
            <Polygon points={[[i - 0.32, 0], [i + 0.32, 0], [i + 0.32, h], [i - 0.32, h]]} color={color(r.type)} fillOpacity={r === best ? 0.85 : 0.45} strokeOpacity={0.9} weight={r === best ? 2.5 : 1} />
            <Label x={i} y={0} attach={h >= 0 ? 's' : 'n'} attachDistance={5} size={11} color="var(--text)">{r.type === 'stock' ? 'stock' : String(r.strike)}</Label>
            <Label x={i} y={h} attach={h >= 0 ? 'n' : 's'} attachDistance={4} size={10} color="var(--text-muted)">{pct(r.ret)}</Label>
          </g>
        );
      })}
    </PlotFrame>
  );

  return (
    <WidgetFrame
      title={title}
      ariaLabel={`With an overnight move of ${pct(J)}, the best instrument is ${best.label}, returning ${pct(best.ret)} against ${pct(rows[0].ret)} for the stock.`}
      plotHeight={HEIGHT}
      plot={plot}
      controls={
        <>
          <Slider label="The insider knows the stock will move" value={J} min={-0.1} max={0.1} step={0.005} onChange={setJ} format={(v) => pct(v)} color="var(--c-spot)" />
          <Segmented label="Option expiry" value={expiry} onChange={setExpiry} options={[
            { value: '1w', label: '1 week', color: 'var(--c-time)' },
            { value: '1m', label: '1 month', color: 'var(--c-time)' },
            { value: '3m', label: '3 months', color: 'var(--c-time)' },
          ]} />
        </>
      }
      readout={
        <dl className="readout-grid">
          <dt>Best choice</dt><dd>{best.label}: {pct(best.ret)} <span className="muted">bought at {best.cost.toFixed(2)}, worth {best.after.toFixed(2)} tomorrow</span></dd>
          <dt>Stock</dt><dd>{pct(rows[0].ret)} <span className="muted">so the best option gives {rows[0].ret > 0 ? `${(best.ret / rows[0].ret).toFixed(0)}×` : '—'} the return per dollar</span></dd>
          <dt>Spread cost</dt><dd>{best.type === 'stock' ? 'negligible' : `${(best.halfSpreadPct * 100).toFixed(1)}% of the price to cross half the spread`}</dd>
        </dl>
      }
      caption="Options on the \$100 stock, on a skewed smile, quoted with the spreads of Chapter 47. Each bar buys at today's ask (or shorts the stock at the bid) and marks the position at fair value one trading day later, after the move. Price impact of the insider's own trading is ignored."
    />
  );
}
