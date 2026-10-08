import { Line, Polyline } from 'mafs';
import { useMemo, useState } from 'react';
import { averagePaid, metaorderPath, noisyPath } from '../../lib/exec/impact';
import { Button, Segmented, Slider } from '../ui/controls';
import { WidgetFrame } from '../ui/WidgetFrame';
import { extent, niceTicks } from './format';
import { Label, PlotFrame } from './PlotFrame';

const STEPS = 60; // one hour of buying, a child order each minute
const HORIZON = 180; // watch for two more hours
const PEAK = 30; // basis points
const NOISE_PER_MINUTE = 10; // 2% daily volatility over a 390-minute day
const HEIGHT = 260;
const AVERAGED = ['1', '100', '10000'] as const;
type Averaged = (typeof AVERAGED)[number];

interface ImpactDecayProps {
  title?: string;
  initialPermanent?: number;
}

/**
 * Chapter 61: a metaorder's price path in the propagator model. Each minute's
 * child order pushes the price by a kernel G(τ) that decays as a power law
 * towards a permanent floor. The thick line is the expected path; the thin one
 * is the average of 1, 100 or 10,000 such metaorders with the market's noise.
 */
export default function ImpactDecay({ title = 'Impact during and after a metaorder', initialPermanent = 0.1 }: ImpactDecayProps) {
  const [beta, setBeta] = useState(0.5);
  const [permanent, setPermanent] = useState(initialPermanent);
  const [averaged, setAveraged] = useState<Averaged>('100');
  const [seed, setSeed] = useState(61);

  const path = useMemo(() => metaorderPath({ beta, permanent }, STEPS, HORIZON, PEAK), [beta, permanent]);
  const noisy = useMemo(() => noisyPath(path, NOISE_PER_MINUTE / Math.sqrt(Number(averaged)), seed), [path, averaged, seed]);
  const paid = averagePaid(path, STEPS);
  const [nLo, nHi] = extent(noisy);
  const yLo = Math.min(-5, nLo - 3), yHi = Math.max(PEAK + 8, nHi + 3);

  const plot = (
    <PlotFrame x={[0, HORIZON]} y={[yLo, yHi]} height={HEIGHT} xTicks={[0, 30, 60, 90, 120, 150, 180]} yTicks={niceTicks(yLo, yHi, 5)} formatX={(v) => `${v / 60}h`} formatY={(v) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v)}`} xLabel="time since the first child order" yLabel="price change (bp)" baseline={0} marginLeft={44}>
      <Line.Segment point1={[STEPS, yLo]} point2={[STEPS, yHi]} color="var(--text-muted)" weight={1} style="dashed" />
      <Label x={STEPS} y={yLo} attach="ne" attachDistance={4} size={11} color="var(--text-muted)">buying stops</Label>
      <Line.Segment point1={[0, paid]} point2={[HORIZON, paid]} color="var(--c-ask)" weight={1.5} style="dashed" />
      <Polyline points={noisy.map((v, t) => [t, v] as [number, number])} color="var(--text-muted)" weight={1.2} fillOpacity={0} />
      <Polyline points={path.map((v, t) => [t, v] as [number, number])} color="var(--c-bid)" weight={3} fillOpacity={0} />
    </PlotFrame>
  );

  const at = (t: number) => path[t];
  return (
    <WidgetFrame
      title={title}
      ariaLabel={`Impact peaks at ${PEAK} basis points when buying stops, then decays to ${at(120).toFixed(1)} after one hour and ${at(180).toFixed(1)} after two; the average price paid was ${paid.toFixed(1)} above the start.`}
      plotHeight={HEIGHT}
      plot={plot}
      controls={
        <>
          <Slider label="Decay exponent of the kernel $\beta$" value={beta} min={0} max={1} step={0.05} onChange={setBeta} format={(v) => v.toFixed(2)} color="var(--c-bid)" />
          <Slider label="Permanent share of each trade's impact" value={permanent} min={0} max={0.3} step={0.01} onChange={setPermanent} format={(v) => `${(v * 100).toFixed(0)}%`} />
          <Segmented label="Metaorders averaged" value={averaged} onChange={setAveraged} options={AVERAGED.map((a) => ({ value: a, label: a === '1' ? 'one metaorder' : `average of ${Number(a).toLocaleString('en-US')}` }))} />
          <Button onClick={() => setSeed((s) => s + 1)}>Re-simulate</Button>
        </>
      }
      readout={
        <dl className="readout-grid">
          <dt>Halfway</dt><dd>+{at(30).toFixed(1)} bp <span className="muted">({((at(30) / PEAK) * 100).toFixed(0)}% of the peak)</span></dd>
          <dt>Peak</dt><dd>+{PEAK.toFixed(1)} bp <span className="muted">when buying stops</span></dd>
          <dt>Average paid</dt><dd>+{paid.toFixed(1)} bp <span className="muted">(dashed pink line)</span></dd>
          <dt>1 hour later</dt><dd>+{at(120).toFixed(1)} bp <span className="muted">({((at(120) / PEAK) * 100).toFixed(0)}% of the peak)</span></dd>
          <dt>2 hours later</dt><dd>+{at(180).toFixed(1)} bp <span className="muted">({((at(180) / PEAK) * 100).toFixed(0)}% of the peak)</span></dd>
        </dl>
      }
      caption="A metaorder buys the same amount every minute for an hour. Each child order's impact decays like a power law towards a permanent floor; the kernel is scaled so that the peak is always 30 bp. Blue: the expected path. Grey: the average price path over one or many such metaorders, including the market's own moves (2% daily volatility)."
    />
  );
}
