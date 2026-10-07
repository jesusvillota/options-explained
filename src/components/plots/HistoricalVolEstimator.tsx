import { Line, Polyline } from 'mafs';
import { useMemo, useState } from 'react';
import { gbmPathVariableVol } from '../../lib/math/rng';
import { historicalVolStdError, rollingVol } from '../../lib/vol/impliedVol';
import { Button, Segmented, Slider } from '../ui/controls';
import { WidgetFrame } from '../ui/WidgetFrame';
import { extent, money, niceTicks } from './format';
import { Label, PlotFrame } from './PlotFrame';

type Regime = 'constant' | 'shift';
const DAYS = 756; // three years of trading days
const SHIFT_DAY = 504;
const volOn = (regime: Regime, day: number) => (regime === 'shift' && day >= SHIFT_DAY ? 0.4 : 0.15);

/**
 * Chapter 25: estimate volatility from a price history. Top: a simulated
 * stock. Bottom: the trailing-window estimate against the true volatility,
 * which can jump from a calm to a turbulent regime. A short window reacts fast
 * but is noisy; a long one is smooth but slow.
 */
export default function HistoricalVolEstimator() {
  const [regime, setRegime] = useState<Regime>('shift');
  const [window, setWindow] = useState(60);
  const [seed, setSeed] = useState(4);
  const trueVol = (day: number) => volOn(regime, day);
  const prices = useMemo(
    () => gbmPathVariableVol(seed, 100, 0.06, Array.from({ length: DAYS }, (_, i) => volOn(regime, i)), 1 / 252),
    [seed, regime],
  );
  const roll = useMemo(() => rollingVol(prices, window), [prices, window]);
  const latest = roll[DAYS];
  const se = historicalVolStdError(latest, window);
  const [plo, phi] = extent(prices);
  const year = (i: number) => i / 252;

  const top = (
    <PlotFrame x={[0, 3]} y={[plo * 0.95, phi * 1.05]} height={170} xTicks={[0, 1, 2, 3]} yTicks={niceTicks(plo * 0.95, phi * 1.05, 4)} formatX={(t) => `year ${t}`} formatY={(v) => money(v, 0)} yLabel="stock price">
      <Polyline points={prices.map((p, i) => [year(i), p] as [number, number])} color="var(--c-spot)" weight={1.5} fillOpacity={0} />
      <Line.Segment point1={[year(DAYS - window), plo * 0.95]} point2={[year(DAYS - window), phi * 1.05]} color="var(--text-muted)" style="dashed" weight={1} />
    </PlotFrame>
  );
  const bottom = (
    <div style={{ borderTop: '1px solid var(--border)' }}>
      <PlotFrame x={[0, 3]} y={[0, 0.6]} height={190} xTicks={[0, 1, 2, 3]} yTicks={[0, 0.2, 0.4, 0.6]} formatX={(t) => `year ${t}`} formatY={(v) => `${Math.round(v * 100)}%`} yLabel="volatility">
        <Polyline points={Array.from({ length: DAYS }, (_, i) => [year(i), trueVol(i)] as [number, number]).concat([[3, trueVol(DAYS - 1)]])} color="var(--c-vol)" weight={2} strokeStyle="dashed" fillOpacity={0} />
        <Polyline points={roll.map((v, i) => [year(i), v] as [number, number]).filter(([, v]) => Number.isFinite(v))} color="var(--c-rate)" weight={2.5} fillOpacity={0} />
        <Label x={0.05} y={trueVol(0)} attach="n" attachDistance={4} size={12} color="var(--c-vol)">true σ</Label>
        <Label x={year(window) + 0.05} y={0.56} attach="e" size={12} color="var(--c-rate)">{window}-day estimate</Label>
      </PlotFrame>
    </div>
  );

  return (
    <WidgetFrame
      title="Estimating volatility from history"
      ariaLabel={`Three years of simulated prices. The ${window}-day historical volatility estimate ends at ${(latest * 100).toFixed(1)}%, against a true volatility of ${trueVol(DAYS - 1) * 100}%.`}
      plotHeight={360}
      plot={<>{top}{bottom}</>}
      controls={
        <>
          <Segmented label="True volatility" value={regime} onChange={setRegime} options={[
            { value: 'constant', label: '15% throughout' },
            { value: 'shift', label: '15% → 40% in year 3' },
          ]} />
          <Button onClick={() => setSeed((s) => s + 1)}>New history</Button>
          <Slider label="Window (trading days)" value={window} min={10} max={250} step={5} onChange={setWindow} format={(v) => `${v} days`} color="var(--c-rate)" />
        </>
      }
      readout={
        <dl className="readout-grid">
          <dt>Latest estimate</dt><dd>{(latest * 100).toFixed(1)}% <span className="muted">± {(se * 100).toFixed(1)}% (σ/√(2n))</span></dd>
          <dt>True volatility now</dt><dd>{Math.round(trueVol(DAYS - 1) * 100)}%</dd>
        </dl>
      }
      caption="Each estimate is √252 times the standard deviation of the daily log returns in the trailing window (the dashed line on the price chart marks its start)."
    />
  );
}
