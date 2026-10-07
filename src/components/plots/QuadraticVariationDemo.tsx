import { Line, Polyline } from 'mafs';
import { useMemo, useState } from 'react';
import { brownianPath, runningQuadraticVariation, runningTotalVariation } from '../../lib/math/brownian';
import { Button, Slider } from '../ui/controls';
import { WidgetFrame } from '../ui/WidgetFrame';
import { Label, PlotFrame } from './PlotFrame';

const HEIGHT = 300;

/**
 * Chapter 15: along one Brownian path, the sum of squared increments settles
 * on t (quadratic variation), while the sum of absolute increments explodes
 * as the steps shrink.
 */
export default function QuadraticVariationDemo() {
  const [power, setPower] = useState(6);
  const [seed, setSeed] = useState(2);
  const n = 2 ** power;
  const path = useMemo(() => brownianPath(seed, n), [seed, n]);
  const qv = runningQuadraticVariation(path);
  const tv = runningTotalVariation(path);
  const stride = Math.max(1, Math.floor(n / 1200));
  const pick = (arr: number[]) => arr.map((v, i) => [i / n, v] as [number, number]).filter((_, i) => i % stride === 0 || i === n);

  return (
    <WidgetFrame
      title="Quadratic variation"
      ariaLabel={`With ${n} steps, the sum of squared increments reaches ${qv[n].toFixed(3)} at t = 1, close to 1; the sum of absolute increments reaches ${tv[n].toFixed(1)}.`}
      plotHeight={HEIGHT}
      plot={
        <PlotFrame x={[0, 1]} y={[-0.05, 1.6]} height={HEIGHT} xTicks={[0, 0.25, 0.5, 0.75, 1]} yTicks={[0, 0.5, 1, 1.5]} formatX={(t) => String(t)} formatY={(v) => String(v)} baseline={0} xLabel="time t" yLabel="running sum">
          <Line.Segment point1={[0, 0]} point2={[1, 1]} color="var(--c-time)" style="dashed" weight={2} />
          <Label x={0.82} y={0.82} attach="se" attachDistance={8} size={12} color="var(--c-time)">y = t</Label>
          <Polyline points={pick(qv)} color="var(--c-spot)" weight={3} fillOpacity={0} />
          <Label x={0.3} y={qv[Math.floor(0.3 * n)]} attach="nw" attachDistance={10} size={12} color="var(--c-spot)">Σ(ΔW)²</Label>
        </PlotFrame>
      }
      controls={
        <>
          <Slider label="Steps $n$" value={power} min={2} max={16} onChange={setPower} format={(v) => (2 ** v).toLocaleString('en-US')} color="var(--c-time)" />
          <Button onClick={() => setSeed((s) => s + 1)}>New path</Button>
        </>
      }
      readout={
        <dl className="readout-grid">
          <dt>Σ (ΔW)² at t = 1</dt><dd>{qv[n].toFixed(4)} <span className="muted">→ 1 as n grows</span></dd>
          <dt>Σ |ΔW| at t = 1</dt><dd>{tv[n].toFixed(2)} <span className="muted">≈ √(2n/π) = {Math.sqrt((2 * n) / Math.PI).toFixed(2)}, → ∞</span></dd>
        </dl>
      }
      caption="Blue: the running sum of squared steps, which settles onto the line y = t as the steps shrink. The total length of the path (sum of absolute steps) instead grows without bound."
    />
  );
}
