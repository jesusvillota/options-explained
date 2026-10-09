import { Line, Polyline } from 'mafs';
import { useMemo, useState } from 'react';
import { dispersionIndex, fitHawkes, simulateHawkes, simulatePoisson, windowCounts } from '../../lib/hf/hawkes';
import { Button, Slider } from '../ui/controls';
import { WidgetFrame } from '../ui/WidgetFrame';
import { niceTicks } from './format';
import { PlotFrame } from './PlotFrame';

const RATE = 2.5; // average events per second, the same for both processes
const SHOW = 60; // seconds drawn
const LONG = 600; // seconds used for the statistics and the fit
const DT = 0.05;

interface HawkesFlowProps {
  title?: string;
  initialBranching?: number;
}

/**
 * Chapter 70: clustered order flow. Top: a Hawkes process, with its intensity
 * jumping at every event and decaying between them. Bottom: a Poisson process
 * with the same average rate. The readout fits the Hawkes parameters by
 * maximum likelihood from ten minutes of events.
 */
export default function HawkesFlow({ title = 'Self-exciting order flow', initialBranching = 0.8 }: HawkesFlowProps) {
  const [n, setN] = useState(initialBranching);
  const [beta, setBeta] = useState(2);
  const [seed, setSeed] = useState(70);
  const p = { mu: RATE * (1 - n), alpha: n * beta, beta };
  const sim = useMemo(() => {
    const hawkes = simulateHawkes(p, LONG, seed), poisson = simulatePoisson(RATE, LONG, seed + 1);
    return { hawkes, poisson, fit: fitHawkes(hawkes, LONG) };
  }, [n, beta, seed]);

  const shown = sim.hawkes.filter((t) => t < SHOW), shownP = sim.poisson.filter((t) => t < SHOW);
  const curve = useMemo(() => {
    const pts: [number, number][] = [];
    let k = 0, excite = 0, last = 0;
    for (let t = 0; t <= SHOW + 1e-9; t += DT) {
      while (k < shown.length && shown[k] <= t) {
        excite = excite * Math.exp(-beta * (shown[k] - last));
        // Draw the jump: the value just before and just after the event.
        pts.push([shown[k], p.mu + excite]);
        excite += p.alpha;
        last = shown[k];
        pts.push([shown[k], p.mu + excite]);
        k++;
      }
      pts.push([t, p.mu + excite * Math.exp(-beta * (t - last))]);
    }
    return pts;
  }, [sim, n, beta]);
  const yMax = Math.max(RATE * 2, ...curve.map((c) => c[1])) * 1.3;
  const tick = yMax * 0.08, tickP = RATE * 0.4;

  const top = (
    <PlotFrame x={[0, SHOW]} y={[0, yMax]} height={180} xTicks={[0, 10, 20, 30, 40, 50, 60]} yTicks={niceTicks(0, yMax, 3)} formatX={(v) => `${v}s`} formatY={(v) => `${v}/s`} yLabel="Hawkes: intensity and events" marginLeft={44}>
      <Polyline points={curve} color="var(--c-bid)" weight={1.5} fillOpacity={0} />
      <Line.Segment point1={[0, RATE]} point2={[SHOW, RATE]} color="var(--text-muted)" weight={1} style="dashed" />
      {shown.map((t) => <Line.Segment key={t} point1={[t, 0]} point2={[t, tick]} color="var(--text)" weight={1} />)}
    </PlotFrame>
  );
  const bottom = (
    <div style={{ borderTop: '1px solid var(--border)' }}>
      <PlotFrame x={[0, SHOW]} y={[0, RATE * 2.6]} height={110} xTicks={[0, 10, 20, 30, 40, 50, 60]} yTicks={[0, RATE]} formatX={(v) => `${v}s`} formatY={(v) => `${v}/s`} xLabel="seconds" yLabel="Poisson, same average rate" marginLeft={44}>
        <Line.Segment point1={[0, RATE]} point2={[SHOW, RATE]} color="var(--text-muted)" weight={1.5} />
        {shownP.map((t) => <Line.Segment key={t} point1={[t, 0]} point2={[t, tickP]} color="var(--text)" weight={1} />)}
      </PlotFrame>
    </div>
  );

  const dH = dispersionIndex(windowCounts(sim.hawkes, LONG, 5)), dP = dispersionIndex(windowCounts(sim.poisson, LONG, 5));
  const f = sim.fit;
  return (
    <WidgetFrame
      title={title}
      ariaLabel={`A Hawkes process with branching ratio ${n.toFixed(2)}: counts in five-second windows have variance ${dH.toFixed(1)} times their mean, against ${dP.toFixed(1)} for a Poisson process.`}
      plotHeight={290}
      plot={<>{top}{bottom}</>}
      controls={
        <>
          <Slider label="Branching ratio $n = \alpha/\beta$" value={n} min={0} max={0.95} step={0.05} onChange={setN} format={(v) => v.toFixed(2)} color="var(--c-bid)" />
          <Slider label="Decay rate $\beta$" value={beta} min={0.5} max={10} step={0.5} onChange={setBeta} format={(v) => `${v.toFixed(1)}/s`} />
          <Button onClick={() => setSeed((s) => s + 1)}>Re-simulate</Button>
        </>
      }
      readout={
        <dl className="readout-grid">
          <dt>Clustering</dt><dd>variance/mean of 5-second counts: {dH.toFixed(1)} <span className="muted">(Poisson: {dP.toFixed(2)})</span></dd>
          <dt>True</dt><dd>μ = {p.mu.toFixed(2)}, α = {p.alpha.toFixed(2)}, β = {p.beta.toFixed(2)} <span className="muted">n = {n.toFixed(2)}</span></dd>
          <dt>Fitted</dt><dd>μ = {f.mu.toFixed(2)}, α = {f.alpha.toFixed(2)}, β = {f.beta.toFixed(2)} <span className="muted">n = {(f.alpha / f.beta).toFixed(2)}, by maximum likelihood on {sim.hawkes.length.toLocaleString('en-US')} events</span></dd>
        </dl>
      }
      caption={`Both processes average ${RATE} events a second (dashed). The Hawkes intensity jumps by α at each event and decays at rate β, so events arrive in bursts. Statistics and the fit use ${LONG / 60} minutes of simulated events; the plot shows the first minute.`}
    />
  );
}
