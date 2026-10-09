import { Line, Plot, Point, Polyline } from 'mafs';
import { useMemo, useState } from 'react';
import { TICKS_PER_DAY, annualise, expectedRV, noiseVariance, optimalSamples, realizedVariance, simulateNoisyDay, twoScaleRV } from '../../lib/hf/realizedNoise';
import { Button, Slider } from '../ui/controls';
import { WidgetFrame } from '../ui/WidgetFrame';
import { niceTicks } from './format';
import { Label, PlotFrame } from './PlotFrame';

const INTERVALS = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800]; // seconds
const X_TICKS = [1, 10, 60, 300, 1800];
const lg = Math.log10;
const label = (s: number) => (s < 60 ? `${Math.round(s)}s` : `${Number((s / 60).toFixed(s < 600 ? 1 : 0))}m`);

interface SignaturePlotProps {
  title?: string;
  initialNoise?: number;
}

/**
 * Chapter 72: the volatility signature plot. Realised volatility of one
 * simulated day, computed from returns at sampling intervals from one second
 * to thirty minutes, against the true volatility; the dashed curve is the
 * expected value σ² + 2nω², and the green line the two-scale estimate.
 */
export default function SignaturePlot({ title = 'The volatility signature plot', initialNoise = 5 }: SignaturePlotProps) {
  const [noiseBp, setNoiseBp] = useState(initialNoise);
  const [vol, setVol] = useState(0.2);
  const [seed, setSeed] = useState(72);
  const sd = vol / Math.sqrt(252), omega = noiseBp / 10000;
  const day = useMemo(() => simulateNoisyDay({ sigmaDaily: sd, omega, seed }), [sd, omega, seed]);
  const obs = useMemo(() => INTERVALS.map((k) => [lg(k), annualise(realizedVariance(day.observed, k))] as [number, number]), [day]);
  const tsrv = useMemo(() => annualise(twoScaleRV(day.observed)), [day]);
  const omegaHat = Math.sqrt(noiseVariance(day.observed));
  const nStar = optimalSamples(sd, omega);
  const kStar = omega > 0 ? Math.min(TICKS_PER_DAY / nStar, 1800) : 1;
  const theory = (x: number) => annualise(expectedRV(sd, omega, TICKS_PER_DAY / 10 ** x));

  const yMax = Math.max(vol * 1.6, ...obs.map((o) => o[1]), theory(0)) * 1.1;
  const yTicks = niceTicks(0, yMax, 4);
  const X: [number, number] = [lg(1) - 0.05, lg(1800) + 0.05];
  const plot = (
    <PlotFrame x={X} y={[0, yMax]} height={290} xTicks={X_TICKS.map(lg)} yTicks={yTicks} formatX={(v) => label(Math.round(10 ** v))} formatY={(v) => `${Math.round(v * 100)}%`} xLabel="sampling interval (log scale)" yLabel="realised volatility (annualised)" marginLeft={48}>
      <Plot.OfX y={theory} color="var(--text-muted)" style="dashed" weight={1.5} domain={X} />
      <Line.Segment point1={[X[0], vol]} point2={[X[1], vol]} color="var(--c-vol)" weight={2} />
      <Label x={X[0] + 0.05} y={vol} attach="ne" attachDistance={4} size={11} color="var(--c-vol)">{`true ${(vol * 100).toFixed(0)}%`}</Label>
      <Line.Segment point1={[X[0], tsrv]} point2={[X[1], tsrv]} color="var(--c-call)" weight={1.5} style="dashed" />
      <Label x={X[0] + 0.05} y={tsrv} attach="se" attachDistance={4} size={11} color="var(--c-call)">{`two-scale ${(tsrv * 100).toFixed(1)}%`}</Label>
      {omega > 0 && kStar < 1800 && (
        <>
          <Line.Segment point1={[lg(kStar), 0]} point2={[lg(kStar), yMax]} color="var(--text-muted)" weight={1} style="dashed" />
          <Label x={lg(kStar)} y={0} attach="ne" attachDistance={4} size={11} color="var(--text-muted)">{`best ≈ ${label(kStar)}`}</Label>
        </>
      )}
      <Polyline points={obs} color="var(--c-spot)" weight={2} fillOpacity={0} />
      {obs.map((o) => <Point key={o[0]} x={o[0]} y={o[1]} color="var(--c-spot)" />)}
    </PlotFrame>
  );

  const at = (k: number) => annualise(realizedVariance(day.observed, k));
  return (
    <WidgetFrame
      title={title}
      ariaLabel={`With ${noiseBp} basis points of noise, realised volatility from one-second returns is ${(at(1) * 100).toFixed(0)}%, from five-minute returns ${(at(300) * 100).toFixed(1)}%, against a true ${(vol * 100).toFixed(0)}%; the two-scale estimate is ${(tsrv * 100).toFixed(1)}%.`}
      plotHeight={290}
      plot={plot}
      controls={
        <>
          <Slider label="Noise $\omega$ (basis points)" value={noiseBp} min={0} max={10} step={0.5} onChange={setNoiseBp} format={(v) => `${v.toFixed(1)} bp`} />
          <Slider label="True volatility $\sigma$" value={vol} min={0.1} max={0.6} step={0.05} onChange={setVol} format={(v) => `${(v * 100).toFixed(0)}%`} color="var(--c-vol)" />
          <Button onClick={() => setSeed((s) => s + 1)}>New day</Button>
        </>
      }
      readout={
        <dl className="readout-grid">
          <dt>Every second</dt><dd>{(at(1) * 100).toFixed(1)}% <span className="muted">23,400 returns</span></dd>
          <dt>Every 5 minutes</dt><dd>{(at(300) * 100).toFixed(1)}% <span className="muted">78 returns</span></dd>
          <dt>Two-scale</dt><dd>{(tsrv * 100).toFixed(1)}% <span className="muted">uses every observation and removes the noise</span></dd>
          <dt>Noise estimate</dt><dd>ω ≈ {(omegaHat * 10000).toFixed(2)} bp <span className="muted">from RV / 2n at one second</span></dd>
        </dl>
      }
      caption="One simulated trading day, observed every second. The true log price is a random walk; each observed price adds independent noise of standard deviation ω, like the bounce between bid and ask. Blue: realised volatility of this day at each sampling interval. Dashed grey: its expected value, √(σ² + 2nω²) annualised. The dashed vertical line is the Bandi–Russell best interval."
    />
  );
}
