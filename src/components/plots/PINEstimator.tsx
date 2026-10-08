import { Line, Point } from 'mafs';
import { useMemo, useState } from 'react';
import { fitPin, pin, simulatePinDays } from '../../lib/info/pin';
import { Button, Segmented, Slider } from '../ui/controls';
import { WidgetFrame } from '../ui/WidgetFrame';
import { niceTicks } from './format';
import { Label, PlotFrame } from './PlotFrame';

const HEIGHT = 300;
const EPS = 50;

/**
 * Chapter 53: days of buy and sell counts from the PIN model. On no-news days
 * buys and sells balance; on news days informed orders pile up on one side.
 * Maximum likelihood recovers the parameters from the counts alone.
 */
export default function PINEstimator({ title = 'Estimating the probability of informed trading' }: { title?: string }) {
  const [alpha, setAlpha] = useState(0.4);
  const [mu, setMu] = useState(40);
  const [days, setDays] = useState<'60' | '120' | '250'>('120');
  const [seed, setSeed] = useState(53);
  const truth = { alpha, delta: 0.5, mu, eps: EPS };
  const sample = useMemo(() => simulatePinDays(truth, Number(days), seed), [alpha, mu, days, seed]);
  const fit = useMemo(() => fitPin(sample), [sample]);
  const max = Math.max(...sample.flatMap((d) => [d.buys, d.sells])) * 1.1;
  const ticks = niceTicks(0, max, 5);
  const colorOf = (n: string) => (n === 'good' ? 'var(--c-call)' : n === 'bad' ? 'var(--c-put)' : 'var(--c-prob)');

  const plot = (
    <PlotFrame x={[0, max]} y={[0, max]} height={HEIGHT} xTicks={ticks} yTicks={ticks} xLabel="buys per day" yLabel="sells per day" marginLeft={40}>
      <Line.Segment point1={[0, 0]} point2={[max, max]} color="var(--text-muted)" style="dashed" weight={1} />
      {sample.map((d, i) => <Point key={i} x={d.buys} y={d.sells} color={colorOf(d.news)} opacity={0.8} />)}
      <Label x={max} y={max * 0.12} attach="w" size={11} color="var(--c-call)">good-news days</Label>
      <Label x={max * 0.02} y={max * 0.75} attach="e" size={11} color="var(--c-put)">bad-news days</Label>
    </PlotFrame>
  );

  const row = (name: string, t: number, e: number, digits = 2) => (
    <tr><td style={{ textAlign: 'left' }}>{name}</td><td>{t.toFixed(digits)}</td><td>{e.toFixed(digits)}</td></tr>
  );

  return (
    <WidgetFrame
      title={title}
      ariaLabel={`${days} simulated days. True PIN ${pin(truth).toFixed(3)}, estimated ${fit.pin.toFixed(3)}.`}
      plotHeight={HEIGHT}
      plot={plot}
      controls={
        <>
          <Slider label="Chance of news each day, $\alpha$" value={alpha} min={0.05} max={0.8} step={0.05} onChange={setAlpha} format={(v) => `${Math.round(v * 100)}%`} color="var(--c-put)" />
          <Slider label="Informed orders on news days, $\mu$" value={mu} min={5} max={80} step={5} onChange={setMu} format={(v) => `${v} a day`} color="var(--c-put)" />
          <Segmented label="Days of data" value={days} onChange={setDays} options={[
            { value: '60', label: '60 days' },
            { value: '120', label: '120 days' },
            { value: '250', label: '250 days' },
          ]} />
          <Button onClick={() => setSeed((s) => s + 1)}>New sample</Button>
        </>
      }
      readout={
        <table className="iter-table">
          <thead><tr><th style={{ textAlign: 'left' }}>Parameter</th><th>True</th><th>Estimated</th></tr></thead>
          <tbody>
            {row('α, chance of news', truth.alpha, fit.alpha)}
            {row('δ, chance it’s bad', truth.delta, fit.delta)}
            {row('μ, informed orders', truth.mu, fit.mu, 1)}
            {row('ε, uninformed per side', truth.eps, fit.eps, 1)}
            {row('PIN', pin(truth), fit.pin, 3)}
          </tbody>
        </table>
      }
      caption="Each dot is one day's count of buyer- and seller-initiated orders. Uninformed traders send about 50 of each per day. On news days, informed traders add orders on one side. The estimate uses only the counts, never the colours."
    />
  );
}
