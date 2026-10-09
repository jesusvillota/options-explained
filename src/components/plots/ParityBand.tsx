import { Line, Polygon } from 'mafs';
import { useMemo, useState } from 'react';
import { chainWithBorrowFee, impliedBorrow, parityArbitrage, parityBand, syntheticMarket, type Frictions } from '../../lib/micro/frictions';
import { Slider } from '../ui/controls';
import { WidgetFrame } from '../ui/WidgetFrame';
import { money, niceTicks } from './format';
import { Label, PlotFrame } from './PlotFrame';

const T = 0.25;
const R = 0.05;
const STRIKES = [80, 85, 90, 95, 100, 105, 110, 115, 120];
const HEIGHT = 300;
const MULTIPLIER = 100;

interface ParityBandProps {
  title?: string;
  initialFee?: number;
  initialShift?: number;
}

/**
 * Chapter 48: put–call parity as a band. For each strike, the vertical bar is
 * the market for the synthetic C − P (bid: sell call, buy put; ask: the
 * reverse), drawn relative to the frictionless parity value S − K e^{−rT}. The
 * shaded band is where no conversion or reversal makes money. Arbitrage needs
 * a bar to lie entirely outside the band.
 */
export default function ParityBand({ title = 'Put–call parity with frictions', initialFee = 0, initialShift = 0 }: ParityBandProps) {
  const [rateGap, setRateGap] = useState(0.005);
  const [stockHalf, setStockHalf] = useState(0.01);
  const [fee, setFee] = useState(initialFee);
  const [shift, setShift] = useState(initialShift);
  const chain = useMemo(() => chainWithBorrowFee(T, STRIKES, fee), [fee]);
  const rows = chain.map((r) => (r.strike === 105 ? { ...r, call: { ...r.call, bid: Math.max(r.call.bid + shift, 0), ask: r.call.ask + shift } } : r));
  const f: Frictions = { stockBid: 100 - stockHalf, stockAsk: 100 + stockHalf, rLend: R, rBorrow: R + rateGap, borrowFee: fee, T };
  const parity = (K: number) => 100 - K * Math.exp(-R * T);
  const data = rows.map((r) => {
    const m = syntheticMarket(r), b = parityBand(r.strike, f), p = parity(r.strike);
    return { K: r.strike, lo: m.bid - p, hi: m.ask - p, bandLo: b.lower - p, bandHi: b.upper - p, arb: parityArbitrage(r, f) };
  });
  const all = data.flatMap((d) => [d.lo, d.hi, d.bandLo, d.bandHi]);
  const yLo = Math.min(...all, -0.6) - 0.1, yHi = Math.max(...all, 0.6) + 0.1;
  const yTicks = niceTicks(yLo, yHi, 5);
  const arbs = data.filter((d) => d.arb.kind);
  const atm = rows.find((r) => r.strike === 100)!;
  const qImplied = impliedBorrow((atm.call.bid + atm.call.ask) / 2, (atm.put.bid + atm.put.ask) / 2, 100, 100, T, R);

  const band: [number, number][] = [...data.map((d) => [d.K, d.bandHi] as [number, number]), ...[...data].reverse().map((d) => [d.K, d.bandLo] as [number, number])];

  const plot = (
    <PlotFrame
      x={[76, 124]}
      y={[Math.min(yLo, yTicks[0]), Math.max(yHi, yTicks[yTicks.length - 1])]}
      height={HEIGHT}
      xTicks={[80, 90, 100, 110, 120]}
      yTicks={yTicks}
      formatX={(v) => `$${v}`}
      formatY={(v) => (v === 0 ? '0' : `${v > 0 ? '+' : '−'}${Math.abs(v).toFixed(1)}`)}
      baseline={0}
      xLabel="strike"
      yLabel="C − P minus (S − K e^(−rT)), $ per share"
      marginLeft={44}
    >
      <Polygon points={band} color="var(--c-strike)" fillOpacity={0.25} strokeOpacity={0.6} weight={1} />
      {data.map((d) => {
        const color = d.arb.kind ? 'var(--c-put)' : 'var(--text)';
        return (
          <g key={d.K}>
            <Line.Segment point1={[d.K, d.lo]} point2={[d.K, d.hi]} color={color} weight={d.arb.kind ? 5 : 3} />
            <Line.Segment point1={[d.K - 0.8, d.lo]} point2={[d.K + 0.8, d.lo]} color="var(--c-bid)" weight={2.5} />
            <Line.Segment point1={[d.K - 0.8, d.hi]} point2={[d.K + 0.8, d.hi]} color="var(--c-ask)" weight={2.5} />
            {d.arb.kind && (
              <Label x={d.K} y={d.arb.kind === 'conversion' ? d.lo : d.hi} attach={d.arb.kind === 'conversion' ? 's' : 'n'} attachDistance={6} size={11} color="var(--c-put)">{d.arb.kind}</Label>
            )}
          </g>
        );
      })}
      <Label x={123} y={0} attach="nw" attachDistance={4} size={11} color="var(--text-muted)">frictionless parity</Label>
    </PlotFrame>
  );

  return (
    <WidgetFrame
      title={title}
      ariaLabel={`Put–call parity band across strikes. ${arbs.length ? `Arbitrage at ${arbs.map((a) => `$${a.K}`).join(', ')}.` : 'No strike offers an arbitrage.'}`}
      plotHeight={HEIGHT}
      plot={plot}
      controls={
        <>
          <Slider label="Borrowing rate above lending rate" value={rateGap} min={0} max={0.03} step={0.0025} onChange={setRateGap} format={(v) => `+${(v * 100).toFixed(2)}%`} color="var(--c-rate)" />
          <Slider label="Stock half-spread" value={stockHalf} min={0} max={0.1} step={0.01} onChange={setStockHalf} format={(v) => `${Math.round(v * 100)}¢`} color="var(--c-spot)" />
          <Slider label="Fee to borrow the stock (hard to borrow)" value={fee} min={0} max={0.1} step={0.005} onChange={setFee} format={(v) => `${(v * 100).toFixed(1)}% a year`} color="var(--c-rate)" />
          <Slider label="Shift the \$105 call's quotes" value={shift} min={-1} max={1} step={0.05} onChange={setShift} format={(v) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(2)}`} color="var(--c-call)" />
        </>
      }
      readout={
        <>
          <p>
            {arbs.length
              ? arbs.map((a) => `$${a.K}: a ${a.arb.kind} locks in ${money(a.arb.profit * MULTIPLIER)} per contract at expiry`).join('; ')
              : 'No arbitrage: every strike’s market overlaps the band.'}
          </p>
          <p className="muted">
            Borrow cost implied by the at-the-money mids: <span className="num">{qImplied < -0.0005 ? '−' : ''}{Math.abs(qImplied * 100).toFixed(1)}%</span> a year.
            The band is {((data[4].bandHi - data[4].bandLo) * 100).toFixed(1)}¢ wide at the money.
          </p>
        </>
      }
      caption="Three-month options on the \$100 stock. Each bar runs from the synthetic's bid (blue tick: sell the call, buy the put) to its ask (pink tick), measured against frictionless parity. The yellow band is where neither a conversion nor a reversal pays."
    />
  );
}
