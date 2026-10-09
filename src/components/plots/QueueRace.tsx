import { Line, Point, Polyline } from 'mafs';
import { useMemo, useState } from 'react';
import { imbalance, queueMicroprice, raceShare, simulateRace, upProbability, upProbabilityGrid, weightedMid } from '../../lib/hf/queues';
import { Button, Slider } from '../ui/controls';
import { WidgetFrame } from '../ui/WidgetFrame';
import { Label, PlotFrame } from './PlotFrame';

const M = 40; // queue cap in the model
const VIEW = 25; // lots shown
const LEVELS = [
  { p: 0.25, color: 'var(--c-ask)', label: 'P(up) = 25%' },
  { p: 0.5, color: 'var(--text-muted)', label: '50%' },
  { p: 0.75, color: 'var(--c-bid)', label: '75%' },
];
const BID = 100, ASK = 100.01, TICK = 0.01;

/** For each bid size, the ask size at which P(up) crosses `level` (P falls as the ask queue grows). */
function isoLine(P: number[][], level: number): [number, number][] {
  const pts: [number, number][] = [];
  for (let x = 1; x <= VIEW; x++) {
    for (let y = 1; y < M; y++) {
      const a = P[x][y], b = P[x][y + 1];
      if (a >= level && b < level) {
        pts.push([x, y + (a - level) / (a - b)]);
        break;
      }
    }
  }
  return pts.filter((p) => p[1] <= VIEW);
}

interface QueueRaceProps {
  title?: string;
}

/**
 * Chapter 71: the race between the best bid and ask queues. Top: the plane of
 * queue sizes, with curves of equal probability that the next move is up and
 * one simulated race from the chosen sizes until a queue empties. Bottom: the
 * up-probability against imbalance at the same total depth, and the weighted
 * mid's implicit assumption that it equals the imbalance.
 */
export default function QueueRace({ title = 'The queue race' }: QueueRaceProps) {
  const [vb, setVb] = useState(10);
  const [va, setVa] = useState(5);
  const [ratio, setRatio] = useState(1);
  const [seed, setSeed] = useState(71);
  const [mc, setMc] = useState<number | null>(null);
  const P = useMemo(() => upProbabilityGrid(M, ratio), [ratio]);
  const race = useMemo(() => simulateRace(vb, va, ratio, seed, M), [vb, va, ratio, seed]);
  const p = P[vb][va];
  const iota = imbalance(vb, va);

  const top = (
    <PlotFrame x={[0, VIEW]} y={[0, VIEW]} height={260} xTicks={[0, 5, 10, 15, 20, 25]} yTicks={[0, 5, 10, 15, 20, 25]} xLabel="lots at the best bid" yLabel="lots at the best ask" marginLeft={40}>
      {LEVELS.map((l) => {
        const line = isoLine(P, l.p);
        const end = line[line.length - 1];
        return (
          <g key={l.p}>
            <Polyline points={line} color={l.color} weight={1.5} strokeStyle={l.p === 0.5 ? 'dashed' : 'solid'} fillOpacity={0} />
            {end && <Label x={end[0]} y={end[1]} attach={l.p === 0.25 ? 'w' : 'n'} attachDistance={6} size={11} color={l.color}>{l.label}</Label>}
          </g>
        );
      })}
      <Polyline points={race.path.map(([b, a]) => [Math.min(b, VIEW), Math.min(a, VIEW)] as [number, number])} color="var(--text)" weight={1.5} strokeOpacity={0.7} fillOpacity={0} />
      <Point x={vb} y={va} color="var(--c-spot)" />
      <Point x={Math.min(race.path[race.path.length - 1][0], VIEW)} y={Math.min(race.path[race.path.length - 1][1], VIEW)} color="var(--text)" />
    </PlotFrame>
  );

  const total = vb + va;
  const splits = Array.from({ length: total - 1 }, (_, i) => i + 1).filter((b) => b <= M && total - b <= M);
  const bottom = (
    <div style={{ borderTop: '1px solid var(--border)' }}>
      <PlotFrame x={[0, 1]} y={[0, 1]} height={170} xTicks={[0, 0.25, 0.5, 0.75, 1]} yTicks={[0, 0.5, 1]} formatX={(v) => v.toFixed(2)} formatY={(v) => `${v * 100}%`} xLabel={`imbalance ι, with ${total} lots in total`} yLabel="P(next move is up)" marginLeft={40}>
        <Line.Segment point1={[0, 0]} point2={[1, 1]} color="var(--text-muted)" weight={1.5} style="dashed" />
        <Label x={0.82} y={0.82} attach="se" attachDistance={6} size={11} color="var(--text-muted)">weighted mid</Label>
        <Polyline points={splits.map((b) => [imbalance(b, total - b), upProbability(b, total - b, ratio, M)] as [number, number])} color="var(--c-bid)" weight={2.5} fillOpacity={0} />
        <Point x={iota} y={p} color="var(--c-spot)" />
      </PlotFrame>
    </div>
  );

  return (
    <WidgetFrame
      title={title}
      ariaLabel={`With ${vb} lots at the bid and ${va} at the ask, the next mid move is up with probability ${(p * 100).toFixed(0)}%.`}
      plotHeight={430}
      plot={<>{top}{bottom}</>}
      controls={
        <>
          <Slider label="Lots at the best bid" value={vb} min={1} max={VIEW} step={1} onChange={(v) => { setVb(v); setMc(null); }} color="var(--c-bid)" />
          <Slider label="Lots at the best ask" value={va} min={1} max={VIEW} step={1} onChange={(v) => { setVa(v); setMc(null); }} color="var(--c-ask)" />
          <Slider label="Refill rate over depletion rate $\lambda/\mu$" value={ratio} min={0.6} max={1} step={0.05} onChange={(v) => { setRatio(v); setMc(null); }} format={(v) => v.toFixed(2)} />
          <Button onClick={() => setSeed((s) => s + 1)}>New race</Button>
          <Button onClick={() => setMc(raceShare(vb, va, ratio, 1000, seed * 31))}>Run 1,000 races</Button>
        </>
      }
      readout={
        <dl className="readout-grid">
          <dt>Imbalance ι</dt><dd>{iota.toFixed(2)}</dd>
          <dt>P(up)</dt><dd>{(p * 100).toFixed(1)}% {mc !== null && <span className="muted">(1,000 races: {(mc * 100).toFixed(1)}%)</span>}</dd>
          <dt>This race</dt><dd>{race.up ? 'the ask emptied first: the mid ticks up' : 'the bid emptied first: the mid ticks down'} <span className="muted">after {race.path.length - 1} events</span></dd>
          <dt>Weighted mid</dt><dd>${weightedMid(BID, ASK, vb, va).toFixed(4)} <span className="muted">quotes $100.00 / $100.01</span></dd>
          <dt>Expected next mid</dt><dd>${queueMicroprice((BID + ASK) / 2, TICK, p).toFixed(4)} <span className="muted">mid + (2P(up) − 1) × 1¢</span></dd>
        </dl>
      }
      caption="Each best queue gains a lot at rate λ and loses one at rate μ, with the four kinds of event independent. The curves join queue sizes with the same chance that the ask empties first, so the mid ticks up. The grey path is one simulated race from the chosen sizes (blue dot) until a queue empties."
    />
  );
}
