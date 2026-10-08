import { Line, Polygon } from 'mafs';
import { useMemo, useState } from 'react';
import { nbbo, routeOrder, threeVenues } from '../../lib/micro/matching';
import type { OrderSide } from '../../lib/micro/orderBook';
import { Segmented, Slider } from '../ui/controls';
import { WidgetFrame } from '../ui/WidgetFrame';
import { money } from './format';
import { Label, PlotFrame } from './PlotFrame';

type Mode = 'smart' | 'A';
const HEIGHT = 340;
const Y: [number, number] = [2.255, 2.79];
const MULTIPLIER = 100;
const BAR = 0.017;
const fee = (f: number) => (f < 0 ? `${(-f).toFixed(2)} rebate` : `${f.toFixed(2)} fee`);

/**
 * Chapter 44: the same call trades on three exchanges. Each column is one
 * exchange's book (bids left of centre, offers right). The dashed lines are the
 * national best bid and offer. Route an order and see where it fills.
 */
interface NBBOBuilderProps {
  title?: string;
  initialSide?: OrderSide;
  initialSize?: number;
  initialMode?: Mode;
}

export default function NBBOBuilder({ title = 'One option, three exchanges', initialSide = 'buy', initialSize = 60, initialMode = 'smart' }: NBBOBuilderProps) {
  const venues = useMemo(() => threeVenues(), []);
  const [side, setSide] = useState<OrderSide>(initialSide);
  const [Q, setQ] = useState(initialSize);
  const [mode, setMode] = useState<Mode>(initialMode);
  const q = nbbo(venues);
  const res = routeOrder(venues, side, Q, mode === 'smart' ? 'smart' : 0);
  const smart = routeOrder(venues, side, Q, 'smart');
  const maxSize = Math.max(...venues.flatMap((v) => [...v.book.bids, ...v.book.asks].map((l) => l.orders.reduce((a, o) => a + o.size, 0))));
  const scale = 0.42 / maxSize;
  const sign = side === 'buy' ? 1 : -1;
  // How much of each venue's level this order takes, in time priority from the inside.
  const takenAt = (v: number, price: number) => res.fills.filter((f) => f.venue === v && Math.abs(f.price - price) < 1e-9).reduce((a, f) => a + f.size, 0);
  const extraCost = sign * (res.netAvgPrice - smart.netAvgPrice) * res.filled * MULTIPLIER;

  const plot = (
    <PlotFrame
      x={[-0.12, 3]}
      y={Y}
      height={HEIGHT}
      xTicks={[]}
      yTicks={[2.3, 2.4, 2.5, 2.6, 2.7]}
      formatY={(v) => v.toFixed(2)}
      xLabel={<>each exchange: <tspan style={{ fill: 'var(--c-bid)' }}>← bids</tspan> · <tspan style={{ fill: 'var(--c-ask)' }}>offers →</tspan></>}
      marginLeft={44}
    >
      {[1, 2].map((x) => <Line.Segment key={x} point1={[x, Y[0]]} point2={[x, Y[1]]} color="var(--border)" weight={1} />)}
      {venues.map((v, i) => {
        const c = i + 0.5;
        return (
          <g key={v.name}>
            <Line.Segment point1={[c, Y[0]]} point2={[c, 2.72]} color="var(--axis)" weight={1} opacity={0.6} />
            <Label x={c} y={Y[1]} attach="s" attachDistance={4} size={12} color="var(--text)">{`Exchange ${v.name}`}</Label>
            <Label x={c} y={Y[1]} attach="s" attachDistance={20} size={10} color="var(--text-muted)">{`take ${fee(v.takeFee)}`}</Label>
            {(['bid', 'ask'] as const).map((s) =>
              (s === 'bid' ? v.book.bids : v.book.asks).map((l) => {
                const size = l.orders.reduce((a, o) => a + o.size, 0);
                const dir = s === 'bid' ? -1 : 1;
                const color = s === 'bid' ? 'var(--c-bid)' : 'var(--c-ask)';
                const taken = (side === 'buy') === (s === 'ask') ? takenAt(i, l.price) : 0;
                const x1 = c + dir * size * scale;
                return (
                  <g key={`${s}${l.price}`}>
                    <Polygon points={[[c, l.price - BAR], [x1, l.price - BAR], [x1, l.price + BAR], [c, l.price + BAR]]} color={color} fillOpacity={0.2} strokeOpacity={0.7} weight={1} />
                    {taken > 0 && (
                      <Polygon points={[[c, l.price - BAR], [c + dir * taken * scale, l.price - BAR], [c + dir * taken * scale, l.price + BAR], [c, l.price + BAR]]} color={color} fillOpacity={0.85} strokeOpacity={0} />
                    )}
                    <Label x={x1} y={l.price} attach={s === 'bid' ? 'w' : 'e'} attachDistance={3} size={10} color="var(--text-muted)">{String(size)}</Label>
                  </g>
                );
              }),
            )}
          </g>
        );
      })}
      {q.bid !== null && <Line.Segment point1={[-0.12, q.bid]} point2={[3, q.bid]} color="var(--c-bid)" style="dashed" weight={1.2} />}
      {q.ask !== null && <Line.Segment point1={[-0.12, q.ask]} point2={[3, q.ask]} color="var(--c-ask)" style="dashed" weight={1.2} />}
    </PlotFrame>
  );

  const byVenue = venues.map((v, i) => ({ name: v.name, size: res.fills.filter((f) => f.venue === i).reduce((a, f) => a + f.size, 0) })).filter((x) => x.size > 0);

  return (
    <WidgetFrame
      title={title}
      ariaLabel={`Three exchanges quote the same call. The national best bid is ${q.bid?.toFixed(2)} and the best offer ${q.ask?.toFixed(2)}. A ${side} of ${Q} routed ${mode === 'smart' ? 'by a smart router' : 'entirely to exchange A'} averages ${res.avgPrice.toFixed(4)}.`}
      plotHeight={HEIGHT}
      plot={plot}
      controls={
        <>
          <Segmented label="Side" value={side} onChange={setSide} options={[
            { value: 'buy', label: 'Buy', color: 'var(--c-ask)' },
            { value: 'sell', label: 'Sell', color: 'var(--c-bid)' },
          ]} />
          <Segmented label="Routing" value={mode} onChange={setMode} options={[
            { value: 'smart', label: 'Smart router' },
            { value: 'A', label: 'Everything to A' },
          ]} />
          <Slider label="Order size" value={Q} min={5} max={100} step={5} onChange={setQ} format={(v) => `${v} contracts`} color={side === 'buy' ? 'var(--c-ask)' : 'var(--c-bid)'} />
        </>
      }
      readout={
        <dl className="readout-grid">
          <dt>NBBO</dt>
          <dd><span style={{ color: 'var(--c-bid)' }}>{q.bid?.toFixed(2)}</span> bid on {q.bidVenues.map((i) => venues[i].name).join(', ')} · <span style={{ color: 'var(--c-ask)' }}>{q.ask?.toFixed(2)}</span> offered on {q.askVenues.map((i) => venues[i].name).join(', ')}</dd>
          <dt>Filled</dt>
          <dd>{res.filled} contracts: {byVenue.map((b) => `${b.size} on ${b.name}`).join(', ')}{res.filled < Q && <span className="bad"> ({Q - res.filled} unfilled)</span>}</dd>
          <dt>Average price</dt>
          <dd>{res.avgPrice.toFixed(4)} <span className="muted">per share</span></dd>
          <dt>Exchange fees</dt>
          <dd>{res.fees < 0 ? '−' : ''}{money(Math.abs(res.fees))} <span className="muted">→ net {res.netAvgPrice.toFixed(4)} per share</span></dd>
          <dt>Trade-throughs</dt>
          <dd className={res.tradeThroughs ? 'bad' : undefined}>
            {res.tradeThroughs
              ? `${res.tradeThroughs} contracts at worse prices than shown elsewhere, costing ${money(extraCost)} against the smart router`
              : 'none: every contract traded at the best price available anywhere'}
          </dd>
        </dl>
      }
      caption="Fees are per contract and illustrative. A is a maker–taker exchange (takers pay, makers earn a rebate), B charges a flat fee, and C is inverted (takers earn a small rebate). Order-protection rules make the router take the best displayed price first; fees only decide among exchanges at the same price."
    />
  );
}
