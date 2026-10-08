import { Line, Point, Polyline } from 'mafs';
import { useMemo, useState } from 'react';
import { averageProfits, gmQuotes, simulateGM } from '../../lib/info/glostenMilgrom';
import { Button, Segmented, Slider } from '../ui/controls';
import { WidgetFrame } from '../ui/WidgetFrame';
import { extent, niceTicks, signedMoney } from './format';
import { Label, PlotFrame } from './PlotFrame';

const VL = 2.2, VH = 2.8;
const N = 40;
const RUNS = 1000;
const MULTIPLIER = 100;

const steps = (ys: number[]): [number, number][] => ys.flatMap((y, t) => [[t, y], [t + 1, y]] as [number, number][]);

interface GlostenMilgromProps {
  title?: string;
  initialAlpha?: number;
}

/**
 * Chapter 50: a market maker who knows only that the call is worth 2.20 or 2.80
 * (equally likely) quotes zero-profit bid and ask prices to a stream of
 * traders, some of whom know the truth. Each trade moves its belief by Bayes'
 * rule; the quotes close in on the true value.
 */
export default function GlostenMilgrom({ title = 'Learning from trades', initialAlpha = 0.3 }: GlostenMilgromProps) {
  const [alpha, setAlpha] = useState(initialAlpha);
  const [high, setHigh] = useState<'high' | 'low'>('high');
  const [tolerance, setTolerance] = useState(0.12);
  const [seed, setSeed] = useState(50);
  const path = useMemo(() => simulateGM({ alpha, vL: VL, vH: VH, p0: 0.5, high: high === 'high', n: N, seed }), [alpha, high, seed]);
  const avg = useMemo(() => averageProfits({ alpha, vL: VL, vH: VH, n: N, runs: RUNS, seed: 5000 }), [alpha]);
  const truth = high === 'high' ? VH : VL;
  const mids = path.belief.slice(0, N).map((p) => VL + p * (VH - VL));
  const first = gmQuotes(0.5, { alpha, vL: VL, vH: VH });
  const halfSpread0 = (first.ask - first.bid) / 2;
  const broken = halfSpread0 > tolerance;
  const within = path.belief.findIndex((p) => Math.abs(VL + p * (VH - VL) - truth) < 0.05);

  const top = (
    <PlotFrame x={[0, N]} y={[2.12, 2.88]} height={230} xTicks={[0, 5, 10, 15, 20, 25, 30, 35, 40]} yTicks={[2.2, 2.4, 2.6, 2.8]} formatY={(v) => v.toFixed(2)} xLabel="trade number" yLabel="price ($ per share)" marginLeft={44}>
      <Line.Segment point1={[0, truth]} point2={[N, truth]} color="var(--c-strike)" style="dashed" weight={1.5} />
      <Label x={N} y={truth} attach={high === 'high' ? 'sw' : 'nw'} attachDistance={4} size={11} color="var(--c-strike)">true value</Label>
      <Polyline points={steps(path.ask)} color="var(--c-ask)" weight={2} fillOpacity={0} />
      <Polyline points={steps(path.bid)} color="var(--c-bid)" weight={2} fillOpacity={0} />
      <Polyline points={steps(mids)} color="var(--text-muted)" weight={1} strokeStyle="dashed" fillOpacity={0} />
      {path.trades.map((t, i) => (
        <Point key={i} x={i + 0.5} y={t.price} color={t.side === 1 ? 'var(--c-ask)' : 'var(--c-bid)'} opacity={t.informed ? 1 : 0.35} />
      ))}
    </PlotFrame>
  );

  const pnls = [avg.insider, avg.uninformed, avg.maker].map((xs) => xs.map((x) => x * MULTIPLIER));
  const [lo, hi] = extent(pnls.flat());
  const span = Math.max(Math.abs(lo), Math.abs(hi), 10) * 1.15;
  const bottom = (
    <div style={{ borderTop: '1px solid var(--border)' }}>
      <PlotFrame x={[0, N]} y={[-span, span]} height={150} xTicks={[0, 5, 10, 15, 20, 25, 30, 35, 40]} yTicks={niceTicks(-span, span, 4)} formatY={(v) => signedMoney(v, 0)} baseline={0} yLabel={`average cumulative profit per contract (${RUNS.toLocaleString('en-US')} runs)`} marginLeft={52}>
        <Polyline points={pnls[0].map((y, t) => [t, y] as [number, number])} color="var(--c-call)" weight={2} fillOpacity={0} />
        <Polyline points={pnls[1].map((y, t) => [t, y] as [number, number])} color="var(--c-put)" weight={2} fillOpacity={0} />
        <Polyline points={pnls[2].map((y, t) => [t, y] as [number, number])} color="var(--text-muted)" weight={2} strokeStyle="dashed" fillOpacity={0} />
        <Label x={N} y={pnls[0][N]} attach="nw" attachDistance={4} size={11} color="var(--c-call)">insiders</Label>
        <Label x={N} y={pnls[1][N]} attach="sw" attachDistance={4} size={11} color="var(--c-put)">uninformed</Label>
      </PlotFrame>
    </div>
  );

  return (
    <WidgetFrame
      title={title}
      ariaLabel={`With ${Math.round(alpha * 100)}% insiders, the first quote is ${first.bid.toFixed(3)} / ${first.ask.toFixed(3)}. After ${N} trades the market maker's estimate is ${(VL + path.belief[N] * (VH - VL)).toFixed(3)}, against a true value of ${truth.toFixed(2)}.`}
      plotHeight={380}
      plot={<>{top}{bottom}</>}
      controls={
        <>
          <Slider label="Share of insiders $\alpha$" value={alpha} min={0} max={0.9} step={0.05} onChange={setAlpha} format={(v) => `${Math.round(v * 100)}%`} color="var(--c-put)" />
          <Segmented label="True value" value={high} onChange={setHigh} options={[
            { value: 'high', label: 'High (2.80)' },
            { value: 'low', label: 'Low (2.20)' },
          ]} />
          <Slider label="Most an uninformed trader will pay to trade now" value={tolerance} min={0.02} max={0.3} step={0.01} onChange={setTolerance} format={(v) => `${Math.round(v * 100)}¢ a share`} />
          <Button onClick={() => setSeed((s) => s + 1)}>New sequence of traders</Button>
        </>
      }
      readout={
        <dl className="readout-grid">
          <dt>First quote</dt>
          <dd>{first.bid.toFixed(3)} / {first.ask.toFixed(3)} <span className="muted">spread {(2 * halfSpread0 * 100).toFixed(1)}¢ = α × 60¢</span></dd>
          <dt>After {N} trades</dt>
          <dd>{path.bid[N - 1].toFixed(3)} / {path.ask[N - 1].toFixed(3)} <span className="muted">belief in the high value {(path.belief[N] * 100).toFixed(1)}%{within > 0 ? `, within 5¢ of the truth after ${within} trades` : ''}</span></dd>
          <dt>This sequence</dt>
          <dd><span className="muted">insiders {signedMoney(path.insiderPnl[N] * MULTIPLIER, 0)}, uninformed {signedMoney(path.uninformedPnl[N] * MULTIPLIER, 0)}, market maker {signedMoney(path.makerPnl[N] * MULTIPLIER, 0)}</span></dd>
          <dt>On average</dt>
          <dd><span className="good">insiders {signedMoney(pnls[0][N], 0)}</span>, <span className="bad">uninformed {signedMoney(pnls[1][N], 0)}</span>, <span className="muted">market maker {signedMoney(pnls[2][N], 0)}</span></dd>
          {broken && (<><dt>Breakdown</dt><dd className="bad">The half-spread ({(halfSpread0 * 100).toFixed(1)}¢) is more than uninformed traders will pay. They leave, and with only insiders left there are no prices at which the market maker can trade.</dd></>)}
        </dl>
      }
      caption="Pink is the ask, blue the bid, dashed grey the market maker's estimate of the value. Each dot is a trade: solid for an insider, faint for an uninformed trader. Bottom: cumulative profits per contract, averaged over 1,000 sequences of traders, half with each true value. The market maker breaks even; insiders win what the uninformed lose."
    />
  );
}
