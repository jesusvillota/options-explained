import { Line, Polygon } from 'mafs';
import { useRef, useState } from 'react';
import { mulberry32 } from '../../lib/math/rng';
import {
  averagePrice,
  bestAsk,
  bestBid,
  callBook,
  cancelOrder,
  findOrder,
  midPrice,
  queueAhead,
  quotedSpread,
  randomEvent,
  submitLimit,
  submitMarket,
  type Book,
  type Fill,
  type OrderSide,
} from '../../lib/micro/orderBook';
import { Button, Segmented, Slider } from '../ui/controls';
import { WidgetFrame } from '../ui/WidgetFrame';
import { money, signedMoney } from './format';
import { Label, PlotFrame } from './PlotFrame';

type OrderType = 'limit' | 'market';
const MULTIPLIER = 100;
const HEIGHT = 440;
const Y: [number, number] = [1.97, 2.98];
const BAR = 0.019; // half-height of a bar, in dollars (the tick is 0.05)

const px = (p: number) => p.toFixed(2);

/** "15 @ 2.55, 25 @ 2.60" — fills grouped by price. */
function describeFills(fills: Fill[]): string {
  const byPrice = new Map<number, number>();
  for (const f of fills) byPrice.set(f.price, (byPrice.get(f.price) ?? 0) + f.size);
  return [...byPrice].map(([p, q]) => `${q} @ ${px(p)}`).join(', ');
}

interface OrderBookProps {
  title?: string;
  caption?: string;
  seed?: number;
}

/**
 * Chapter 43: the limit order book behind a quote. Each bar is one resting
 * order, stacked outwards from the centre in time priority, so the order nearest
 * the centre fills first. Send limit or market orders, or let other traders act.
 */
export default function OrderBook({ title = 'Order book · three-month $105 call', caption, seed = 43 }: OrderBookProps) {
  const [book, setBook] = useState<Book>(() => callBook());
  const [side, setSide] = useState<OrderSide>('buy');
  const [type, setType] = useState<OrderType>('limit');
  const [limit, setLimit] = useState(2.45);
  const [size, setSize] = useState(10);
  const [position, setPosition] = useState(0);
  const [cash, setCash] = useState(0); // dollars paid (negative = received)
  const [message, setMessage] = useState('Your move: send an order, or let the market trade.');
  const rng = useRef(mulberry32(seed));

  const myFillsFrom = (fills: Fill[]) => fills.filter((f) => f.makerOwner === 'you');
  const settle = (fills: Fill[], dir: 1 | -1) => {
    const q = fills.reduce((a, f) => a + f.size, 0);
    const paid = fills.reduce((a, f) => a + f.size * f.price, 0) * MULTIPLIER;
    setPosition((p) => p + dir * q);
    setCash((c) => c + dir * paid);
  };

  const send = () => {
    const mid = midPrice(book);
    if (type === 'market') {
      const res = submitMarket(book, { side, size });
      setBook(res.book);
      settle(res.fills, side === 'buy' ? 1 : -1);
      const avg = averagePrice(res.fills);
      if (!avg) return setMessage('Nothing to trade against: that side of the book is empty.');
      const vsMid = mid === null ? '' : `, ${Math.abs((avg - mid) * 100).toFixed(1)}¢ ${side === 'buy' ? 'above' : 'below'} the old mid`;
      setMessage(
        `You ${side === 'buy' ? 'bought' : 'sold'} ${res.filled}: ${describeFills(res.fills)}. Average ${avg.toFixed(4)}${vsMid}.` +
          (res.unfilled ? ` ${res.unfilled} could not be filled: the book ran out.` : ''),
      );
      return;
    }
    const res = submitLimit(book, { side, price: limit, size });
    setBook(res.book);
    settle(res.fills, side === 'buy' ? 1 : -1);
    const traded = res.filled ? `Traded ${res.filled} on arrival (${describeFills(res.fills)}). ` : '';
    const rested = res.restingId !== null
      ? `${res.filled ? 'The remaining' : 'Your'} ${size - res.filled} rest${size - res.filled === 1 ? 's' : ''} as a ${side === 'buy' ? 'bid' : 'offer'} at ${px(limit)}, with ${queueAhead(res.book, res.restingId)} contracts ahead of you.`
      : '';
    setMessage(traded + rested);
  };

  const trade = (events: number) => {
    let b = book;
    const counts = { limit: 0, cancel: 0, market: 0 };
    let volume = 0;
    const mine: Fill[] = [];
    for (let i = 0; i < events; i++) {
      const ev = randomEvent(b, rng.current);
      b = ev.book;
      counts[ev.kind]++;
      volume += ev.fills.reduce((a, f) => a + f.size, 0);
      for (const f of myFillsFrom(ev.fills)) mine.push(f);
    }
    setBook(b);
    // A fill against your resting bid means you bought; against your offer, you sold.
    const bought = mine.filter((f) => findSideOfFill(book, f) === 'bid');
    const sold = mine.filter((f) => !bought.includes(f));
    if (bought.length) settle(bought, 1);
    if (sold.length) settle(sold, -1);
    const yours = mine.length
      ? ` Your resting orders traded: ${bought.length ? `bought ${describeFills(bought)}` : ''}${bought.length && sold.length ? '; ' : ''}${sold.length ? `sold ${describeFills(sold)}` : ''}.`
      : '';
    const n = (k: number, word: string) => `${k} ${word}${k === 1 ? '' : 's'}`;
    setMessage(`${events} events: ${n(counts.limit, 'new limit order')}, ${n(counts.cancel, 'cancellation')}, ${n(counts.market, 'market order')} (${volume} contracts traded).${yours}`);
  };

  const myOrders = [...book.bids, ...book.asks].flatMap((l) => l.orders).filter((o) => o.owner === 'you');
  const cancelMine = () => {
    let b = book;
    for (const o of myOrders) b = cancelOrder(b, o.id);
    setBook(b);
    setMessage(myOrders.length ? `Cancelled ${myOrders.length} resting order${myOrders.length > 1 ? 's' : ''}.` : 'You have no resting orders.');
  };
  const reset = () => {
    setBook(callBook());
    rng.current = mulberry32(seed);
    setPosition(0);
    setCash(0);
    setMessage('Back to the opening book.');
  };

  const bb = bestBid(book), ba = bestAsk(book), mid = midPrice(book), spr = quotedSpread(book);
  const levelSizes = [...book.bids, ...book.asks].map((l) => l.orders.reduce((a, o) => a + o.size, 0));
  const xMax = Math.max(120, Math.ceil((Math.max(0, ...levelSizes) * 1.4) / 50) * 50);
  const xTicks = [-xMax, -xMax / 2, 0, xMax / 2, xMax];
  const gap = xMax * 0.006;
  const markToMid = mid === null ? null : position * mid * MULTIPLIER - cash;
  const sideColor = side === 'buy' ? 'var(--c-bid)' : 'var(--c-ask)';
  const visible = (p: number) => p > Y[0] && p < Y[1];

  const plot = (
    <PlotFrame
      x={[-xMax, xMax]}
      y={Y}
      height={HEIGHT}
      xTicks={xTicks}
      yTicks={[2.0, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9]}
      formatX={(v) => String(Math.abs(v))}
      formatY={(v) => v.toFixed(2)}
      xLabel={<>contracts: <tspan style={{ fill: 'var(--c-bid)' }}>← bids (buyers)</tspan> · <tspan style={{ fill: 'var(--c-ask)' }}>asks (sellers) →</tspan></>}
      yLabel="price ($ per share)"
      marginLeft={44}
    >
      <Line.Segment point1={[0, Y[0]]} point2={[0, Y[1]]} color="var(--axis)" weight={1} />
      {(['bid', 'ask'] as const).map((s) =>
        (s === 'bid' ? book.bids : book.asks).filter((l) => visible(l.price)).map((level) => {
          const dir = s === 'bid' ? -1 : 1;
          let cum = 0;
          const total = level.orders.reduce((a, o) => a + o.size, 0);
          const mine = level.orders.filter((o) => o.owner === 'you').reduce((a, o) => a + o.size, 0);
          const color = s === 'bid' ? 'var(--c-bid)' : 'var(--c-ask)';
          return (
            <g key={`${s}${level.price}`}>
              {level.orders.map((o) => {
                const x0 = dir * (cum + gap), x1 = dir * (cum + o.size - gap);
                cum += o.size;
                const you = o.owner === 'you';
                return (
                  <Polygon
                    key={o.id}
                    points={[[x0, level.price - BAR], [x1, level.price - BAR], [x1, level.price + BAR], [x0, level.price + BAR]]}
                    color={you ? 'var(--text)' : color}
                    fillOpacity={you ? 0.85 : 0.45}
                    strokeOpacity={you ? 1 : 0.7}
                    weight={you ? 2 : 1}
                  />
                );
              })}
              <Label x={dir * total} y={level.price} attach={s === 'bid' ? 'w' : 'e'} attachDistance={5} size={11} color={mine ? 'var(--text)' : 'var(--text-muted)'}>
                {mine ? `${total} (you: ${mine})` : String(total)}
              </Label>
            </g>
          );
        }),
      )}
      {mid !== null && (
        <>
          <Line.Segment point1={[-xMax, mid]} point2={[xMax, mid]} color="var(--text-muted)" style="dashed" weight={1.2} />
          <Label x={xMax} y={mid} attach="w" attachDistance={4} size={11} color="var(--text-muted)">mid {mid.toFixed(3)}</Label>
        </>
      )}
    </PlotFrame>
  );

  return (
    <WidgetFrame
      title={title}
      ariaLabel={`Order book with best bid ${bb === null ? 'none' : px(bb)} and best ask ${ba === null ? 'none' : px(ba)}. Bids are drawn to the left, asks to the right, one bar per resting order.`}
      plotHeight={HEIGHT}
      plot={plot}
      controls={
        <>
          <Segmented label="Side" value={side} onChange={setSide} options={[
            { value: 'buy', label: 'Buy', color: 'var(--c-bid)' },
            { value: 'sell', label: 'Sell', color: 'var(--c-ask)' },
          ]} />
          <Segmented label="Order type" value={type} onChange={setType} options={[
            { value: 'limit', label: 'Limit order' },
            { value: 'market', label: 'Market order' },
          ]} />
          {type === 'limit' && (
            <Slider label="Limit price" value={limit} min={2.0} max={2.95} step={0.05} onChange={(v) => setLimit(Math.round(v * 100) / 100)} format={(v) => `$${v.toFixed(2)}`} color={sideColor} />
          )}
          <Slider label="Size (contracts)" value={size} min={5} max={150} step={5} onChange={setSize} color={sideColor} />
          <Button onClick={send}>Send order</Button>
          <Button onClick={() => trade(10)}>Let the market trade (10 events)</Button>
          <Button onClick={cancelMine} disabled={myOrders.length === 0}>Cancel my orders</Button>
          <Button onClick={reset}>Reset</Button>
        </>
      }
      readout={
        <>
          <p>
            Best bid <strong className="num" style={{ color: 'var(--c-bid)' }}>{bb === null ? '—' : px(bb)}</strong>, best ask{' '}
            <strong className="num" style={{ color: 'var(--c-ask)' }}>{ba === null ? '—' : px(ba)}</strong>
            {spr !== null && <>, spread <span className="num">{px(spr)}</span></>}.
          </p>
          <p>{message}</p>
          {myOrders.length > 0 && (
            <p className="muted">
              Resting: {myOrders.map((o) => `${o.side === 'bid' ? 'bid' : 'offer'} ${o.size} @ ${px(o.price)} (${queueAhead(book, o.id)} ahead)`).join('; ')}.
            </p>
          )}
          <p className="muted">
            Your position: <span className="num">{position > 0 ? '+' : position < 0 ? '−' : ''}{Math.abs(position)}</span> contracts,{' '}
            {cash >= 0 ? 'paid' : 'received'} <span className="num">{money(Math.abs(cash))}</span>
            {markToMid !== null && position !== 0 && (
              <>; profit if marked at the mid <span className={`num ${markToMid >= 0 ? 'good' : 'bad'}`}>{signedMoney(markToMid)}</span></>
            )}.
          </p>
        </>
      }
      caption={caption ?? 'Each bar is one resting order. At each price the order nearest the centre arrived first and fills first. Your orders are drawn in white (black in the light theme). Prices are per share; one contract is 100 shares.'}
    />
  );
}

/** Which side of the book a fill was resting on, looked up in the book before the events. */
function findSideOfFill(before: Book, fill: Fill): 'bid' | 'ask' {
  const o = findOrder(before, fill.makerId);
  return o?.side ?? 'bid';
}
