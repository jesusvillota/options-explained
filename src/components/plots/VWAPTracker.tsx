import { Polygon, Polyline } from 'mafs';
import { Fragment, useMemo, useState } from 'react';
import { algoSchedule, simulateDay, slippageVsVwap, trackingStudy, volumeCurve, type Algo } from '../../lib/exec/algos';
import { Button, Segmented, Slider } from '../ui/controls';
import { WidgetFrame } from '../ui/WidgetFrame';
import { niceTicks } from './format';
import { Label, PlotFrame } from './PlotFrame';

const X = 0.1; // buy 10% of an average day's volume
const DAYS = 500;
const NAMES: Record<Algo, string> = { twap: 'TWAP', vwap: 'VWAP', pov: 'POV 10%' };
const HOURS = [0, 1.5, 3.5, 5.5, 6.5];
const clock = (h: number) => {
  const m = 9 * 60 + 30 + Math.round(h * 60);
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
};
const signedBp = (v: number) => `${v > 0.005 ? '+' : v < -0.005 ? '−' : ''}${Math.abs(v).toFixed(1)} bp`;

interface VWAPTrackerProps {
  title?: string;
  initialAlgo?: Algo;
}

/**
 * Chapter 64: tracking the VWAP benchmark. Top: one simulated day's volume in
 * five-minute bins against the historical curve. Bottom: the share of the
 * order done against the share of the day's volume traded so far; a perfect
 * VWAP tracker follows the market's curve.
 */
export default function VWAPTracker({ title = 'Tracking VWAP', initialAlgo = 'vwap' }: VWAPTrackerProps) {
  const [algo, setAlgo] = useState<Algo>(initialAlgo);
  const [noise, setNoise] = useState(0.4);
  const [seed, setSeed] = useState(64);
  const curve = useMemo(() => volumeCurve(), []);
  const day = useMemo(() => simulateDay(seed, { binNoise: noise }), [seed, noise]);
  const trades = algoSchedule(algo, X, day.volume);
  const slip = slippageVsVwap(trades, day.price, day.volume);
  const studies = useMemo(() => Object.fromEntries((['twap', 'vwap', 'pov'] as Algo[]).map((a) => [a, trackingStudy(a, X, DAYS, 1000, { binNoise: noise })])) as Record<Algo, ReturnType<typeof trackingStudy>>, [noise]);

  const n = curve.length, w = 6.5 / n;
  const hours = (k: number) => k * w;
  const vMax = Math.max(...day.volume, ...curve) * 100 * 1.25;
  const top = (
    <PlotFrame x={[0, 6.5]} y={[0, vMax]} height={160} xTicks={HOURS} yTicks={niceTicks(0, vMax, 3)} formatX={clock} formatY={(v) => `${v}%`} yLabel="volume per 5 minutes" marginLeft={40}>
      {day.volume.map((v, k) => (
        <Polygon key={k} points={[[hours(k) + 0.01, 0], [hours(k + 1) - 0.01, 0], [hours(k + 1) - 0.01, v * 100], [hours(k) + 0.01, v * 100]]} color="var(--text-muted)" fillOpacity={0.35} strokeOpacity={0} />
      ))}
      <Polyline points={curve.map((c, k) => [hours(k + 0.5), c * 100] as [number, number])} color="var(--text)" weight={2} fillOpacity={0} />
      <Label x={3.25} y={curve[39] * 100} attach="n" attachDistance={8} size={11} color="var(--text)">historical curve</Label>
    </PlotFrame>
  );

  const cum = (xs: number[]) => {
    const total = xs.reduce((a, b) => a + b, 0);
    let s = 0;
    return [[0, 0] as [number, number], ...xs.map((x, k) => {
      s += x;
      return [hours(k + 1), (s / total) * 100] as [number, number];
    })];
  };
  const bottom = (
    <div style={{ borderTop: '1px solid var(--border)' }}>
      <PlotFrame x={[0, 6.5]} y={[0, 110]} height={190} xTicks={HOURS} yTicks={[0, 25, 50, 75, 100]} formatX={clock} formatY={(v) => `${v}%`} yLabel="done so far" marginLeft={40}>
        <Polyline points={cum(day.volume)} color="var(--text)" weight={1.5} strokeStyle="dashed" fillOpacity={0} />
        <Polyline points={cum(trades)} color="var(--c-bid)" weight={3} fillOpacity={0} />
        <Label x={2.6} y={cum(day.volume)[31][1]} attach="nw" attachDistance={6} size={11} color="var(--text)">market volume</Label>
        <Label x={3.2} y={cum(trades)[38][1]} attach="se" attachDistance={6} size={11} color="var(--c-bid)">your order</Label>
      </PlotFrame>
    </div>
  );

  const total = day.volume.reduce((a, b) => a + b, 0);
  return (
    <WidgetFrame
      title={title}
      ariaLabel={`Buying with ${NAMES[algo]} on a day with ${(total * 100).toFixed(0)}% of average volume, the order paid ${signedBp(slip)} against the market's VWAP.`}
      plotHeight={350}
      plot={<>{top}{bottom}</>}
      controls={
        <>
          <Segmented label="Algorithm" value={algo} onChange={setAlgo} options={(['twap', 'vwap', 'pov'] as Algo[]).map((a) => ({ value: a, label: NAMES[a] }))} />
          <Slider label="Volume noise (bin to bin)" value={noise} min={0} max={0.8} step={0.05} onChange={setNoise} format={(v) => v.toFixed(2)} />
          <Button onClick={() => setSeed((s) => s + 1)}>New day</Button>
        </>
      }
      readout={
        <dl className="readout-grid">
          <dt>This day</dt><dd>{signedBp(slip)} against VWAP <span className="muted">(volume {(total * 100).toFixed(0)}% of average)</span></dd>
          {(['twap', 'vwap', 'pov'] as Algo[]).map((a) => (
            <Fragment key={a}><dt>{a === algo ? <strong>{NAMES[a]}</strong> : NAMES[a]}</dt><dd>±{studies[a].sd.toFixed(1)} bp <span className="muted">over {DAYS} days{a === 'pov' ? `; ${(studies.pov.catchUp * 100).toFixed(0)}% need a catch-up at the close` : ''}</span></dd></Fragment>
          ))}
        </dl>
      }
      caption="Buying 10% of an average day's volume in a stock with 2% daily volatility. Top: each five minutes' volume as a percentage of an average day's. TWAP buys the same amount every five minutes; VWAP follows the historical volume curve; POV buys 10% of whatever trades, and whatever is left at 15:55 in the last five minutes. The ± figures are the standard deviation of the price paid against the market's VWAP over simulated days."
    />
  );
}
