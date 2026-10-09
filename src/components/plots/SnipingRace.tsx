import { Line, Point, Polyline } from 'mafs';
import { Fragment, useMemo, useState } from 'react';
import { equilibriumHalfSpread, providerWinProb, raceOnce, simulateWinShare, snipeProb } from '../../lib/hf/marketDesign';
import { Button, Slider } from '../ui/controls';
import { WidgetFrame } from '../ui/WidgetFrame';
import { niceTicks } from './format';
import { Label, PlotFrame } from './PlotFrame';

const JITTER = 5;
const BATCH = 100000; // 100 ms in microseconds
const NS = Array.from({ length: 10 }, (_, i) => i + 1);

const cents = (v: number) => (v < 0.01 ? v.toPrecision(2) : v.toFixed(v < 1 ? 3 : 2));

interface SnipingRaceProps {
  title?: string;
}

/**
 * Chapter 73: the latency race. Top: one race after a news jump: when the
 * provider's cancel and each sniper's order reach the exchange. Bottom: the
 * half-spread that just pays for the sniping losses, against the number of
 * fast traders, in a continuous market and in 100-millisecond batch auctions.
 */
export default function SnipingRace({ title = 'The race after the news' }: SnipingRaceProps) {
  const [N, setN] = useState(3);
  const [edge, setEdge] = useState(0);
  const [seed, setSeed] = useState(73);
  const p = { snipers: N, edge, jitter: JITTER };
  const race = raceOnce(p, seed);
  const first = Math.min(race.provider, ...race.snipers);
  const mc = useMemo(() => simulateWinShare(p, 2000, 7300), [N, edge]);
  const tMax = Math.max(50, ...race.snipers, race.provider) + 5;

  const rows = N + 1;
  const top = (
    <PlotFrame x={[0, tMax]} y={[-0.8, rows - 0.2]} height={60 + 22 * rows} xTicks={niceTicks(0, tMax, 5)} yTicks={[]} formatX={(v) => `${v} μs`} xLabel="time after the news" marginLeft={16}>
      <Line.Segment point1={[0, -0.8]} point2={[0, rows - 0.2]} color="var(--text-muted)" weight={1.5} style="dashed" />
      <Line.Segment point1={[first, -0.8]} point2={[first, rows - 0.2]} color="var(--text)" weight={1} />
      {[race.provider, ...race.snipers].map((t, i) => {
        const y = rows - 1 - i, isProvider = i === 0, winner = t === first;
        const color = isProvider ? 'var(--c-spot)' : 'var(--c-ask)';
        return (
          <Fragment key={i}>
            <Polyline points={[[0, y], [t, y]]} color={color} weight={winner ? 3 : 1.5} strokeOpacity={winner ? 1 : 0.5} fillOpacity={0} />
            <Point x={t} y={y} color={color} />
            <Label x={t} y={y} attach="e" attachDistance={8} size={11} color={color}>{`${isProvider ? 'provider cancels' : `sniper ${i}`}${winner ? ' — first' : ''}`}</Label>
          </Fragment>
        );
      })}
    </PlotFrame>
  );

  const cont = NS.map((n) => [n, equilibriumHalfSpread(snipeProb({ snipers: n, edge, jitter: JITTER }))] as [number, number]);
  const batch = NS.map((n) => [n, equilibriumHalfSpread(snipeProb({ snipers: n, edge, jitter: JITTER }, BATCH))] as [number, number]);
  const yMax = Math.max(...cont.map((c) => c[1]), 1) * 1.3;
  const bottom = (
    <div style={{ borderTop: '1px solid var(--border)' }}>
      <PlotFrame x={[0.5, 10.5]} y={[0, yMax]} height={180} xTicks={NS} yTicks={niceTicks(0, yMax, 3)} formatY={(v) => `${v}¢`} xLabel="number of fast traders sniping" yLabel="break-even half-spread" marginLeft={40}>
        <Polyline points={cont} color="var(--c-ask)" weight={2.5} fillOpacity={0} />
        <Polyline points={batch} color="var(--c-call)" weight={2.5} strokeStyle="dashed" fillOpacity={0} />
        <Label x={10} y={cont[9][1]} attach="nw" attachDistance={6} size={11} color="var(--c-ask)">continuous market</Label>
        <Label x={10} y={batch[9][1]} attach="nw" attachDistance={6} size={11} color="var(--c-call)">100 ms batches</Label>
        <Point x={N} y={cont[N - 1][1]} color="var(--c-ask)" />
      </PlotFrame>
    </div>
  );

  const pi = snipeProb(p), h = equilibriumHalfSpread(pi);
  return (
    <WidgetFrame
      title={title}
      ariaLabel={`With ${N} snipers and a provider edge of ${edge} microseconds, the provider cancels in time ${(providerWinProb(p) * 100).toFixed(0)}% of the time, and the break-even half-spread is ${h.toFixed(2)} cents.`}
      plotHeight={60 + 22 * rows + 180}
      plot={<>{top}{bottom}</>}
      controls={
        <>
          <Slider label="Fast traders sniping" value={N} min={1} max={10} step={1} onChange={setN} color="var(--c-ask)" />
          <Slider label="Provider's speed edge" value={edge} min={-10} max={10} step={1} onChange={setEdge} format={(v) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v)} μs`} color="var(--c-spot)" />
          <Button onClick={() => setSeed((s) => s + 1)}>Race again</Button>
        </>
      }
      readout={
        <dl className="readout-grid">
          <dt>Provider cancels in time</dt><dd>{(providerWinProb(p) * 100).toFixed(1)}% <span className="muted">(2,000 simulated races: {(mc * 100).toFixed(1)}%)</span></dd>
          <dt>Break-even half-spread</dt><dd>{h.toFixed(2)}¢ <span className="muted">in a continuous market; {cents(equilibriumHalfSpread(snipeProb(p, BATCH)))}¢ with 100 ms batches</span></dd>
        </dl>
      }
      caption="A \$100 stock's value jumps 10¢ on public news about once a minute; ordinary investors trade about twice a minute. Every firm reacts to the news after the same 20 μs plus a random delay averaging 5 μs. The provider's cancel and the snipers' orders race to the exchange; if a sniper arrives first, it trades at the stale quote. The provider sets the half-spread so that what investors pay covers what snipers take."
    />
  );
}
