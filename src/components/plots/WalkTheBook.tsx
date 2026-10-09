import { Line, Point, Polygon, Polyline } from 'mafs';
import { useMemo, useState } from 'react';
import { callBook, levelsOf, midPrice, walkTheBook } from '../../lib/micro/orderBook';
import { Segmented, Slider } from '../ui/controls';
import { WidgetFrame } from '../ui/WidgetFrame';
import { money } from './format';
import { Label, PlotFrame } from './PlotFrame';

type Side = 'buy' | 'sell';
type Depth = '0.5' | '1' | '3';
const MULTIPLIER = 100;
const Q_MAX = 400;
const HEIGHT = 330;
const Y: [number, number] = [1.95, 3.0];

/** Staircase through the levels: price pᵢ from cumulative size Σ_{j<i} q_j to Σ_{j≤i} q_j. */
function staircase(levels: { price: number; size: number }[], qMax: number): [number, number][] {
  const pts: [number, number][] = [];
  let cum = 0;
  for (const l of levels) {
    if (cum >= qMax) break;
    pts.push([cum, l.price], [Math.min(cum + l.size, qMax), l.price]);
    cum += l.size;
  }
  return pts;
}

interface WalkTheBookProps {
  title?: string;
  caption?: string;
  initialSize?: number;
}

/**
 * Chapter 43: a market order "walks the book". The staircase is the price of
 * the Q-th contract (the book's cumulative depth turned on its side); the
 * smooth curve is the average price paid. The shaded area between the staircase
 * and the mid is the total cost of trading relative to the mid.
 */
export default function WalkTheBook({ title = 'Walking the book', caption, initialSize = 100 }: WalkTheBookProps) {
  const [side, setSide] = useState<Side>('buy');
  const [depth, setDepth] = useState<Depth>('1');
  const [Q, setQ] = useState(initialSize);
  const book = useMemo(() => callBook(Number(depth)), [depth]);
  const mid = midPrice(book)!;
  const asks = levelsOf(book, 'ask');
  const bids = levelsOf(book, 'bid');
  const levels = side === 'buy' ? asks : bids;
  const w = walkTheBook(levels, Q);
  const best = levels[0].price;
  const sign = side === 'buy' ? 1 : -1;
  const color = side === 'buy' ? 'var(--c-ask)' : 'var(--c-bid)';
  const other = side === 'buy' ? 'var(--c-bid)' : 'var(--c-ask)';

  const avgCurve = useMemo(() => {
    const pts: [number, number][] = [];
    for (let q = 1; q <= Q_MAX; q++) {
      const r = walkTheBook(levels, q);
      if (r.filled < q) break;
      pts.push([q, r.avgPrice]);
    }
    return pts;
  }, [levels]);

  // Area between the staircase and the mid, up to the filled size.
  const filledStairs = staircase(levels, w.filled);
  const area: [number, number][] = [[0, mid], ...filledStairs, [w.filled, mid]];
  const costVsMid = sign * (w.cost - w.filled * mid) * MULTIPLIER;
  const exhausted = w.filled < Q;

  const plot = (
    <PlotFrame
      x={[0, Q_MAX]}
      y={Y}
      height={HEIGHT}
      xTicks={[0, 50, 100, 150, 200, 250, 300, 350, 400]}
      yTicks={[2.0, 2.2, 2.4, 2.6, 2.8, 3.0]}
      formatY={(v) => v.toFixed(2)}
      xLabel="order size Q (contracts)"
      yLabel="price ($ per share)"
      marginLeft={44}
    >
      <Polyline points={staircase(side === 'buy' ? bids : asks, Q_MAX)} color={other} weight={1.5} strokeOpacity={0.35} fillOpacity={0} />
      {w.filled > 0 && <Polygon points={area} color={color} fillOpacity={0.18} strokeOpacity={0} />}
      <Line.Segment point1={[0, mid]} point2={[Q_MAX, mid]} color="var(--text-muted)" style="dashed" weight={1.2} />
      <Polyline points={staircase(levels, Q_MAX)} color={color} weight={2.5} fillOpacity={0} />
      <Polyline points={avgCurve} color="var(--text)" weight={2} strokeStyle="dashed" fillOpacity={0} />
      <Line.Segment point1={[w.filled, Y[0]]} point2={[w.filled, Y[1]]} color="var(--text-muted)" weight={1} opacity={0.6} />
      {w.filled > 0 && (
        <>
          <Point x={w.filled} y={w.avgPrice} color="var(--text)" />
          <Label x={w.filled} y={w.avgPrice} attach={side === 'buy' ? 'se' : 'ne'} attachDistance={8} size={12} color="var(--text)">
            average {w.avgPrice.toFixed(4)}
          </Label>
          <Point x={w.filled} y={w.marginalPrice} color={color} />
          <Label x={w.filled} y={w.marginalPrice} attach={side === 'buy' ? 'nw' : 'sw'} attachDistance={8} size={12} color={color}>
            last fill {w.marginalPrice.toFixed(2)}
          </Label>
        </>
      )}
      <Label x={Q_MAX} y={mid} attach="nw" attachDistance={4} size={11} color="var(--text-muted)">mid {mid.toFixed(3)}</Label>
    </PlotFrame>
  );

  return (
    <WidgetFrame
      title={title}
      ariaLabel={`A market ${side} of ${Q} contracts fills ${w.filled} over ${w.levelsUsed} price levels, at an average of ${w.avgPrice.toFixed(4)} against a best ${side === 'buy' ? 'ask' : 'bid'} of ${best.toFixed(2)} and a mid of ${mid.toFixed(3)}.`}
      plotHeight={HEIGHT}
      plot={plot}
      controls={
        <>
          <Segmented label="Side" value={side} onChange={setSide} options={[
            { value: 'buy', label: 'Market buy', color: 'var(--c-ask)' },
            { value: 'sell', label: 'Market sell', color: 'var(--c-bid)' },
          ]} />
          <Segmented label="Book depth" value={depth} onChange={setDepth} options={[
            { value: '0.5', label: 'Thin (×½)' },
            { value: '1', label: 'As shown' },
            { value: '3', label: 'Deep (×3)' },
          ]} />
          <Slider label="Order size $Q$" value={Q} min={5} max={Q_MAX} step={5} onChange={setQ} format={(v) => `${v} contracts`} color={color} />
        </>
      }
      readout={
        <dl className="readout-grid">
          <dt>Fills</dt>
          <dd>{w.fills.length > 4 ? `${w.levelsUsed} levels, from ${best.toFixed(2)} to ${w.marginalPrice.toFixed(2)}` : w.fills.map((f) => `${f.size} @ ${f.price.toFixed(2)}`).join(', ')}</dd>
          <dt>Average price p̄</dt>
          <dd>{w.avgPrice.toFixed(4)} <span className="muted">({sign * (w.avgPrice - best) >= 0.00005 ? `${(sign * (w.avgPrice - best) * 100).toFixed(2)}¢ worse than the best ${side === 'buy' ? 'ask' : 'bid'}` : `the best ${side === 'buy' ? 'ask' : 'bid'}`})</span></dd>
          <dt>Cash</dt>
          <dd>{money(w.cost * MULTIPLIER)} <span className="muted">{side === 'buy' ? 'paid' : 'received'} for {w.filled} contracts</span></dd>
          <dt>Cost vs the mid</dt>
          <dd><span className="bad">{money(costVsMid)}</span> <span className="muted">= {(sign * (w.avgPrice - mid) * 100).toFixed(2)}¢ × {w.filled} × 100 (shaded area)</span></dd>
          {exhausted && (<><dt>Warning</dt><dd className="bad">The book ran out: {Q - w.filled} contracts unfilled.</dd></>)}
        </dl>
      }
      caption={caption ?? 'The solid staircase is the price of the last contract filled, the dashed curve is the average price, and the faint staircase is the other side of the book. The shaded area is what the order costs compared with trading everything at the mid.'}
    />
  );
}
