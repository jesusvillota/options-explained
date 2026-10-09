import { Line, Point, Polygon, Polyline } from 'mafs';
import { useMemo, useState } from 'react';
import { decompose, rollSpread, simulateTrades } from '../../lib/micro/liquidity';
import { Button, Slider } from '../ui/controls';
import { WidgetFrame } from '../ui/WidgetFrame';
import { extent, niceTicks } from './format';
import { Label, PlotFrame } from './PlotFrame';

const H = 0.075; // half-spread of the $105 call's 2.40 / 2.55 quote
const N = 4000;
const SHOW = 50;
const cents = (v: number) => `${(Math.abs(v) < 0.0005 ? 0 : v * 100).toFixed(1)}¢`;

/**
 * Chapter 47: trades from a simple structural model. Each trade happens half a
 * spread away from the efficient price, and moves that price by λ in its own
 * direction. Measured over many trades, the effective half-spread splits into
 * a realised half-spread (kept by the liquidity provider) and price impact.
 */
export default function SpreadDecomposition({ title = 'Where does the spread go?' }: { title?: string }) {
  const [share, setShare] = useState(0.4);
  const [news, setNews] = useState(0.02);
  const [k, setK] = useState(5);
  const [seed, setSeed] = useState(47);
  const lambda = share * H;
  const tape = useMemo(() => simulateTrades({ n: N, h: H, lambda, sigmaU: news, m0: 2.475, seed }), [lambda, news, seed]);
  const d = decompose(tape, k);
  const roll = rollSpread(tape.price) / 2;

  const shown = tape.price.slice(0, SHOW);
  const [lo, hi] = extent([...shown, ...tape.mid.slice(0, SHOW + 1)]);
  const pad = 0.03;
  const yTicks = niceTicks(lo - pad, hi + pad, 4);
  const top = (
    <PlotFrame x={[0, SHOW]} y={[Math.min(lo - pad, yTicks[0]), Math.max(hi + pad, yTicks[yTicks.length - 1])]} height={210} xTicks={[0, 10, 20, 30, 40, 50]} yTicks={yTicks} formatY={(v) => v.toFixed(2)} xLabel="trade number" yLabel="price ($ per share)" marginLeft={44}>
      <Polyline points={tape.mid.slice(0, SHOW + 1).flatMap((m, t) => [[t, m], [t + 1, m]] as [number, number][]).slice(0, 2 * SHOW)} color="var(--text-muted)" weight={1.5} fillOpacity={0} />
      {shown.map((p, t) => (
        <Point key={t} x={t + 0.5} y={p} color={tape.sign[t] > 0 ? 'var(--c-ask)' : 'var(--c-bid)'} />
      ))}
    </PlotFrame>
  );

  const bars = [
    { label: 'effective', value: d.effective, color: 'var(--text)' },
    { label: 'realised', value: d.realised, color: 'var(--c-call)' },
    { label: 'impact', value: d.impact, color: 'var(--c-put)' },
    { label: 'Roll', value: roll, color: 'var(--text-muted)' },
  ];
  const yMin = Math.min(0, ...bars.map((b) => (Number.isFinite(b.value) ? b.value : 0))) - 0.01;
  const bottom = (
    <div style={{ borderTop: '1px solid var(--border)' }}>
      <PlotFrame x={[0.4, 4.6]} y={[yMin, 0.12]} height={170} xTicks={[]} yTicks={niceTicks(yMin, 0.1, 4)} formatY={(v) => `${Math.round(v * 100)}¢`} baseline={0} yLabel="per share, per trade" marginLeft={44}>
        <Line.Segment point1={[0.4, H]} point2={[4.6, H]} color="var(--c-strike)" style="dashed" weight={1.2} />
        <Label x={4.6} y={H} attach="nw" attachDistance={4} size={11} color="var(--c-strike)">quoted half-spread 7.5¢</Label>
        {bars.map((b, i) => {
          const x = i + 1;
          const v = Number.isFinite(b.value) ? b.value : 0;
          return (
            <g key={b.label}>
              <Polygon points={[[x - 0.28, 0], [x + 0.28, 0], [x + 0.28, v], [x - 0.28, v]]} color={b.color} fillOpacity={0.6} strokeOpacity={0.9} weight={1} />
              <Label x={x} y={Math.min(v, 0)} attach="s" attachDistance={5} size={12} color="var(--text)">{b.label}</Label>
              <Label x={x} y={Math.max(v, 0)} attach="n" attachDistance={5} size={11} color="var(--text-muted)">{Number.isFinite(b.value) ? cents(b.value) : 'n/a'}</Label>
            </g>
          );
        })}
      </PlotFrame>
    </div>
  );

  return (
    <WidgetFrame
      title={title}
      ariaLabel={`Effective half-spread ${cents(d.effective)}, of which the liquidity provider keeps ${cents(d.realised)} and loses ${cents(d.impact)} to price impact. Roll's estimate of the half-spread is ${Number.isFinite(roll) ? cents(roll) : 'undefined'}.`}
      plotHeight={380}
      plot={<>{top}{bottom}</>}
      controls={
        <>
          <Slider label="Information in each trade, $\lambda/h$" value={share} min={0} max={1} step={0.05} onChange={setShare} format={(v) => `${Math.round(v * 100)}%`} color="var(--c-put)" />
          <Slider label="Public news between trades" value={news} min={0} max={0.06} step={0.005} onChange={setNews} format={(v) => cents(v)} />
          <Slider label="Measure the mid $k$ trades later" value={k} min={1} max={20} step={1} onChange={setK} format={(v) => `${v}`} />
          <Button onClick={() => setSeed((s) => s + 1)}>Re-simulate</Button>
        </>
      }
      readout={
        <dl className="readout-grid">
          <dt>Effective</dt><dd>{cents(d.effective)} <span className="muted">what takers pay against the mid</span></dd>
          <dt>Realised</dt><dd className={d.realised < 0 ? 'bad' : 'good'}>{cents(d.realised)} <span className="muted">what makers keep, {k} trade{k > 1 ? 's' : ''} later</span></dd>
          <dt>Impact</dt><dd>{cents(d.impact)} <span className="muted">model value λ = {cents(lambda)}</span></dd>
          <dt>Roll's estimate</dt><dd>{Number.isFinite(roll) ? `${cents(roll)} half-spread` : 'undefined (positive autocovariance)'} <span className="muted">from {N.toLocaleString('en-US')} trade prices alone</span></dd>
        </dl>
      }
      caption="Top: the first 50 trades. The grey steps are the efficient price; pink dots are buys at the ask, blue dots sells at the bid. Bottom: averages over 4,000 simulated trades. Effective = realised + impact, always."
    />
  );
}
