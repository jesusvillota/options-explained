import { Line, Point, Polyline } from 'mafs';
import { useMemo, useState } from 'react';
import { clearAuction, demandAt, openingOrders, priceGrid, supplyAt, type AuctionOrder } from '../../lib/micro/auction';
import { Button, Segmented, Slider } from '../ui/controls';
import { WidgetFrame } from '../ui/WidgetFrame';
import { niceTicks } from './format';
import { Label, PlotFrame } from './PlotFrame';

const HEIGHT = 300;
const GRID = priceGrid(2.2, 2.8, 0.05);
const REFERENCE = 2.48;

/** Centred steps: the value at each tick price drawn across half a tick either side. */
function steps(values: [number, number][]): [number, number][] {
  const h = 0.025;
  return values.flatMap(([p, v]) => [[p - h, v], [p + h, v]] as [number, number][]);
}

/**
 * Chapter 45: an opening call auction. Orders are collected, demand (falling)
 * and supply (rising) are drawn against price, and everything trades at the one
 * price where the most contracts can change hands.
 */
export default function CallAuction({ title = 'The opening auction' }: { title?: string }) {
  const [seed, setSeed] = useState(45);
  const [mine, setMine] = useState<AuctionOrder[]>([]);
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [kind, setKind] = useState<'limit' | 'market'>('limit');
  const [limit, setLimit] = useState(2.5);
  const [size, setSize] = useState(40);
  const base = useMemo(() => openingOrders(seed), [seed]);
  const orders = [...base, ...mine];
  const res = clearAuction(orders, GRID, REFERENCE);
  const demand = GRID.map((p) => [p, demandAt(orders, p)] as [number, number]);
  const supply = GRID.map((p) => [p, supplyAt(orders, p)] as [number, number]);
  const yMax = Math.max(...demand.map((d) => d[1]), ...supply.map((s) => s[1])) * 1.12;
  const yTicks = niceTicks(0, yMax, 4);

  const add = () => {
    const id = 1000 + mine.length;
    setMine([...mine, { id, side, limit: kind === 'market' ? null : limit, size, owner: 'you' }]);
  };

  const plot = (
    <PlotFrame
      x={[2.17, 2.83]}
      y={[0, Math.max(yMax, yTicks[yTicks.length - 1])]}
      height={HEIGHT}
      xTicks={[2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8]}
      yTicks={yTicks}
      formatX={(v) => v.toFixed(2)}
      xLabel="auction price ($ per share)"
      yLabel="contracts"
      marginLeft={40}
    >
      <Polyline points={steps(demand)} color="var(--c-bid)" weight={2.5} fillOpacity={0} />
      <Polyline points={steps(supply)} color="var(--c-ask)" weight={2.5} fillOpacity={0} />
      <Label x={2.81} y={demand[demand.length - 1][1]} attach="nw" attachDistance={12} size={12} color="var(--c-bid)">demand (buyers)</Label>
      <Label x={2.19} y={supply[0][1]} attach="ne" attachDistance={12} size={12} color="var(--c-ask)">supply (sellers)</Label>
      {res.price !== null && (
        <>
          <Line.Segment point1={[res.price, 0]} point2={[res.price, yMax]} color="var(--text)" style="dashed" weight={1.2} />
          <Point x={res.price} y={res.volume} color="var(--text)" />
          <Label x={res.price} y={yMax} attach={res.price < 2.6 ? 'se' : 'sw'} attachDistance={6} size={12} color="var(--text)">
            {`opens at ${res.price.toFixed(2)}: ${res.volume} contracts`}
          </Label>
        </>
      )}
    </PlotFrame>
  );

  const yourFills = mine.map((o) => ({ o, f: res.fills.get(o.id) ?? 0 }));

  return (
    <WidgetFrame
      title={title}
      ariaLabel={`Opening auction: demand and supply curves cross at ${res.price?.toFixed(2) ?? 'no price'}, where ${res.volume} contracts trade.`}
      plotHeight={HEIGHT}
      plot={plot}
      controls={
        <>
          <Segmented label="Your side" value={side} onChange={setSide} options={[
            { value: 'buy', label: 'Buy', color: 'var(--c-bid)' },
            { value: 'sell', label: 'Sell', color: 'var(--c-ask)' },
          ]} />
          <Segmented label="Order type" value={kind} onChange={setKind} options={[
            { value: 'limit', label: 'Limit' },
            { value: 'market', label: 'Market (any price)' },
          ]} />
          {kind === 'limit' && <Slider label="Limit price" value={limit} min={2.2} max={2.8} step={0.05} onChange={(v) => setLimit(Math.round(v * 100) / 100)} format={(v) => `$${v.toFixed(2)}`} color={side === 'buy' ? 'var(--c-bid)' : 'var(--c-ask)'} />}
          <Slider label="Size (contracts)" value={size} min={5} max={150} step={5} onChange={setSize} color={side === 'buy' ? 'var(--c-bid)' : 'var(--c-ask)'} />
          <Button onClick={add}>Add my order</Button>
          <Button onClick={() => setMine([])} disabled={mine.length === 0}>Remove my orders</Button>
          <Button onClick={() => { setSeed((s) => s + 1); setMine([]); }}>New set of orders</Button>
        </>
      }
      readout={
        <>
          <p>
            Clearing price <strong className="num">{res.price === null ? '—' : res.price.toFixed(2)}</strong>, volume{' '}
            <strong className="num">{res.volume}</strong> contracts.{' '}
            {res.imbalance !== 0 && (
              <span className="muted">{Math.abs(res.imbalance)} more contracts {res.imbalance > 0 ? 'wanted by buyers' : 'offered by sellers'} at that price than can be matched; the excess is left over.</span>
            )}
          </p>
          {yourFills.length > 0 && (
            <p>
              Your orders:{' '}
              {yourFills.map(({ o, f }) => `${o.side} ${o.size}${o.limit === null ? ' at market' : ` @ ${o.limit.toFixed(2)}`} → ${f} filled`).join('; ')}.
            </p>
          )}
          <p className="muted">{orders.filter((o) => o.side === 'buy').length} buy and {orders.filter((o) => o.side === 'sell').length} sell orders collected before the open.</p>
        </>
      }
      caption="Everyone who trades in the auction trades at the same price. Buyers with limits above it and sellers with limits below it fill in full; orders limited exactly at it share what's left."
    />
  );
}
