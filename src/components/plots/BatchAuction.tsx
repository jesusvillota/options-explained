import { Line, Plot, Point } from 'mafs';
import { useState } from 'react';
import { equilibriumHalfSpread, expectedLead, snipeProb } from '../../lib/hf/marketDesign';
import { Slider } from '../ui/controls';
import { WidgetFrame } from '../ui/WidgetFrame';
import { niceTicks } from './format';
import { Label, PlotFrame } from './PlotFrame';

const JITTER = 5;
const X: [number, number] = [0, 6]; // log10 of the batch interval in microseconds
const X_TICKS = [0, 1, 2, 3, 4, 5, 6];
const fmtInterval = (us: number) => (us < 1000 ? `${Math.round(us)} μs` : us < 1e6 ? `${Number((us / 1000).toPrecision(2))} ms` : `${Number((us / 1e6).toPrecision(2))} s`);

const cents = (v: number) => (v < 0.01 ? v.toPrecision(2) : v.toFixed(v < 1 ? 3 : 2));

interface BatchAuctionProps {
  title?: string;
}

/**
 * Chapter 73: frequent batch auctions. The break-even half-spread against the
 * length of the batch interval. A continuous market is the limit of a very
 * short interval; once the interval is much longer than the gaps between
 * traders' reaction times, races are rarely decided by speed.
 */
export default function BatchAuction({ title = 'Continuous trading against batch auctions' }: BatchAuctionProps) {
  const [logTau, setLogTau] = useState(5);
  const [N, setN] = useState(3);
  const [edge, setEdge] = useState(0);
  const p = { snipers: N, edge, jitter: JITTER };
  const tau = 10 ** logTau;
  const cont = equilibriumHalfSpread(snipeProb(p));
  const at = (x: number) => equilibriumHalfSpread(snipeProb(p, 10 ** x));
  const yMax = Math.max(cont, 1) * 1.3;

  const plot = (
    <PlotFrame x={X} y={[0, yMax]} height={260} xTicks={X_TICKS} yTicks={niceTicks(0, yMax, 4)} formatX={(v) => fmtInterval(10 ** v)} formatY={(v) => `${v}¢`} xLabel="batch interval (log scale)" yLabel="break-even half-spread" marginLeft={40}>
      <Line.Segment point1={[X[0], cont]} point2={[X[1], cont]} color="var(--c-ask)" weight={1.5} style="dashed" />
      <Label x={X[1]} y={cont} attach="nw" attachDistance={4} size={11} color="var(--c-ask)">continuous market</Label>
      <Plot.OfX y={at} color="var(--c-call)" weight={2.5} domain={X} />
      <Point x={logTau} y={at(logTau)} color="var(--c-call)" />
    </PlotFrame>
  );

  const pc = snipeProb(p), pb = snipeProb(p, tau);
  return (
    <WidgetFrame
      title={title}
      ariaLabel={`With ${fmtInterval(tau)} batches, a news event is sniped with probability ${(pb * 100).toFixed(2)}%, against ${(pc * 100).toFixed(0)}% in a continuous market; the break-even half-spread falls from ${cont.toFixed(2)} to ${at(logTau).toFixed(3)} cents.`}
      plotHeight={260}
      plot={plot}
      controls={
        <>
          <Slider label="Batch interval" value={logTau} min={0} max={6} step={0.1} onChange={setLogTau} format={(v) => fmtInterval(10 ** v)} color="var(--c-call)" />
          <Slider label="Fast traders sniping" value={N} min={1} max={10} step={1} onChange={setN} color="var(--c-ask)" />
          <Slider label="Provider's speed edge" value={edge} min={-10} max={10} step={1} onChange={setEdge} format={(v) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v)} μs`} color="var(--c-spot)" />
        </>
      }
      readout={
        <dl className="readout-grid">
          <dt>News sniped</dt><dd>{(pb * 100).toFixed(pb < 0.01 ? 3 : 1)}% <span className="muted">of the time in batches; {(pc * 100).toFixed(0)}% when trading is continuous</span></dd>
          <dt>Half-spread</dt><dd>{cents(at(logTau))}¢ <span className="muted">against {cont.toFixed(2)}¢ continuous</span></dd>
          <dt>Fastest sniper's lead</dt><dd>{expectedLead(p).toFixed(1)} μs on average <span className="muted">counting races it loses as zero</span></dd>
        </dl>
      }
      caption="The same traders and news as above. In a frequent batch auction, all orders that arrive during an interval are treated as simultaneous and matched together at its end, so a sniper only wins if the batch happens to close in the few microseconds between its order and the provider's cancel."
    />
  );
}
