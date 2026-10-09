import { Point, Polygon, Polyline } from 'mafs';
import { useMemo, useState } from 'react';
import { simulateQuoting, type QuotingParams } from '../../lib/mm/quoting';
import { Button, Segmented, Slider } from '../ui/controls';
import { WidgetFrame } from '../ui/WidgetFrame';
import { extent, money, niceTicks } from './format';
import { Label, PlotFrame } from './PlotFrame';

const DAYS = 3;
const KEEP = 900;
const MULTIPLIER = 100;
const FIXED: Omit<QuotingParams, 'edgeVol' | 'tied' | 'reaction' | 'seed'> = {
  seconds: 23400 * DAYS, latency: 5, sniperSpeed: 50, jumpRate: 1 / 300, jumpSize: 0.4, volJump: 0.005, customerRate: 1 / 20, customerTolerance: 1,
};
const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

interface QuoteEngineProps {
  title?: string;
  initialTied?: boolean;
}

/**
 * Chapter 56: a market maker quotes a one-month at-the-money call at theo ± an
 * edge in volatility points. Customers trade more when the quote is tight; on
 * news, the market maker races fast traders to update, and loses the race some
 * of the time. Top: the first 15 minutes. Bottom: P&L per day over three days.
 */
export default function QuoteEngine({ title = 'A quote engine under fire', initialTied = false }: QuoteEngineProps) {
  const [edge, setEdge] = useState(0.5);
  const [reaction, setReaction] = useState(100);
  const [tied, setTied] = useState<'off' | 'on'>(initialTied ? 'on' : 'off');
  const [seed, setSeed] = useState(56);
  const res = useMemo(() => simulateQuoting({ ...FIXED, edgeVol: edge, reaction, tied: tied === 'on', seed }, KEEP), [edge, reaction, tied, seed]);

  const [lo, hi] = extent([...res.bid, ...res.ask, ...res.theo]);
  const pad = (hi - lo) * 0.08;
  const yTicks = niceTicks(lo - pad, hi + pad, 4);
  const steps = (ys: number[]) => ys.flatMap((y, i) => [[res.t[i] - 1, y], [res.t[i], y]] as [number, number][]);
  const top = (
    <PlotFrame x={[0, KEEP]} y={[Math.min(lo - pad, yTicks[0]), Math.max(hi + pad, yTicks[yTicks.length - 1])]} height={220} xTicks={[0, 180, 360, 540, 720, 900]} yTicks={yTicks} formatX={clock} formatY={(v) => v.toFixed(2)} xLabel="minutes : seconds" yLabel="call price ($ per share)" marginLeft={44}>
      <Polyline points={steps(res.ask)} color="var(--c-ask)" weight={1.5} fillOpacity={0} />
      <Polyline points={steps(res.bid)} color="var(--c-bid)" weight={1.5} fillOpacity={0} />
      <Polyline points={res.t.map((t, i) => [t, res.theo[i]] as [number, number])} color="var(--text)" weight={1.2} strokeStyle="dashed" fillOpacity={0} />
      {res.trades.map((tr, i) => <Point key={i} x={tr.t} y={tr.price} color={tr.sniper ? 'var(--c-put)' : 'var(--c-call)'} opacity={tr.sniper ? 1 : 0.7} />)}
    </PlotFrame>
  );

  const perDay = (x: number) => (x * MULTIPLIER) / DAYS;
  const bars = [
    { label: 'customer edge', v: perDay(res.customerEdge), color: 'var(--c-call)' },
    { label: 'picked off', v: -perDay(res.sniperLoss), color: 'var(--c-put)' },
    { label: 'net', v: perDay(res.customerEdge - res.sniperLoss), color: 'var(--text)' },
  ];
  const span = Math.max(...bars.map((b) => Math.abs(b.v)), 100) * 1.6;
  const bottom = (
    <div style={{ borderTop: '1px solid var(--border)' }}>
      <PlotFrame x={[0.4, 3.6]} y={[-span * 0.6, span]} height={150} xTicks={[]} yTicks={niceTicks(-span * 0.6, span, 4)} formatY={(v) => `${v < 0 ? '−' : ''}$${Math.abs(v).toLocaleString('en-US')}`} baseline={0} yLabel="P&L per day, per contract quoted" marginLeft={56}>
        {bars.map((b, i) => (
          <g key={b.label}>
            <Polygon points={[[i + 0.7, 0], [i + 1.3, 0], [i + 1.3, b.v], [i + 0.7, b.v]]} color={b.color} fillOpacity={0.6} strokeOpacity={0.9} weight={1} />
            <Label x={i + 1} y={b.v} attach={b.v >= 0 ? 'n' : 's'} attachDistance={4} size={11} color="var(--text)">{`${b.label}: ${b.v < 0 ? '−' : ''}${money(Math.abs(b.v), 0)}`}</Label>
          </g>
        ))}
      </PlotFrame>
    </div>
  );

  return (
    <WidgetFrame
      title={title}
      ariaLabel={`Quoting at ±${edge} volatility points, ${tied === 'on' ? 'tied to the stock' : 'not tied to the stock'}, reacting in ${reaction} ms: customer edge ${money(perDay(res.customerEdge), 0)} a day, ${money(perDay(res.sniperLoss), 0)} lost to pick-offs.`}
      plotHeight={370}
      plot={<>{top}{bottom}</>}
      controls={
        <>
          <Slider label="Half-spread $e_\sigma$ (vol points)" value={edge} min={0.25} max={2} step={0.05} onChange={setEdge} format={(v) => v.toFixed(2)} color="var(--c-vol)" />
          <Slider label="Reaction time to news" value={reaction} min={5} max={300} step={5} onChange={setReaction} format={(v) => `${v} ms`} color="var(--c-time)" />
          <Segmented label="Tie quotes to the stock" value={tied} onChange={setTied} options={[
            { value: 'off', label: 'Quotes fixed between updates' },
            { value: 'on', label: 'Tied to the stock' },
          ]} />
          <Button onClick={() => setSeed((s) => s + 1)}>New days</Button>
        </>
      }
      readout={
        <dl className="readout-grid">
          <dt>Customers</dt><dd>{Math.round(res.customerTrades / DAYS)} trades a day, {res.customerTrades ? ((res.customerEdge / res.customerTrades) * 100).toFixed(1) : '0'}¢ edge each</dd>
          <dt>Picked off</dt><dd>{res.sniperTrades / DAYS < 1 ? (res.sniperTrades / DAYS).toFixed(1) : Math.round(res.sniperTrades / DAYS)} times a day, {res.sniperTrades ? ((res.sniperLoss / res.sniperTrades) * 100).toFixed(1) : '0'}¢ lost each</dd>
          <dt>Net</dt><dd className={res.customerEdge > res.sniperLoss ? 'good' : 'bad'}>{res.customerEdge >= res.sniperLoss ? '+' : '−'}{money(Math.abs(perDay(res.customerEdge - res.sniperLoss)), 0)} a day, for one contract on each side</dd>
        </dl>
      }
      caption="A one-month at-the-money call on the \$100 stock. Dashed: the option's fair value; pink and blue: the market maker's ask and bid. Green dots are customer trades, red dots are pick-offs by fast traders after news. Each quote shows one contract; once hit, it stays down until the next update (routine updates every 5 seconds). Trades are marked at fair value and delta-hedged."
    />
  );
}
