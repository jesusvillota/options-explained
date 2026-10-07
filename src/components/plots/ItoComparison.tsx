import { Polyline } from 'mafs';
import { useMemo, useState } from 'react';
import { brownianPath, itoSquareSums } from '../../lib/math/brownian';
import { Button, Slider } from '../ui/controls';
import { WidgetFrame } from '../ui/WidgetFrame';
import { extent } from './format';
import { Label, PlotFrame } from './PlotFrame';

const HEIGHT = 320;

/**
 * Chapter 17: along a Brownian path, compare W_t² with the "ordinary
 * calculus" answer ∫2W dW (summed left-endpoint style) and with Itô's answer
 * ∫2W dW + t.
 */
export default function ItoComparison() {
  const [power, setPower] = useState(10);
  const [seed, setSeed] = useState(4);
  const n = 2 ** power;
  const W = useMemo(() => brownianPath(seed, n), [seed, n]);
  const { naive, corrected } = itoSquareSums(W);
  const stride = Math.max(1, Math.floor(n / 1000));
  const series = (arr: number[]) => arr.filter((_, i) => i % stride === 0).map((v, k) => [(k * stride) / n, v] as [number, number]);
  const sq = W.map((w) => w * w);
  const [lo, hi] = extent([extent(sq), extent(naive), extent(corrected)].flat());
  const pad = (hi - lo) * 0.1 + 0.1;
  const gap = sq[n] - naive[n];

  return (
    <WidgetFrame
      title="Ordinary calculus vs Itô"
      ariaLabel={`Along one Brownian path, W squared ends at ${sq[n].toFixed(3)}; the chain-rule sum ends at ${naive[n].toFixed(3)}, short by ${gap.toFixed(3)}, close to t = 1.`}
      plotHeight={HEIGHT}
      plot={
        <PlotFrame x={[0, 1]} y={[lo - pad, hi + pad]} height={HEIGHT} xTicks={[0, 0.25, 0.5, 0.75, 1]} yTicks={[-2, -1, 0, 1, 2, 3, 4].filter((v) => v > lo - pad && v < hi + pad)} formatX={(t) => String(t)} formatY={String} baseline={0} xLabel="time t">
          <Polyline points={series(sq)} color="var(--text)" weight={3} fillOpacity={0} />
          <Polyline points={series(naive)} color="var(--c-put)" weight={2} fillOpacity={0} />
          <Polyline points={series(corrected)} color="var(--c-call)" weight={2} strokeStyle="dashed" fillOpacity={0} />
          <Label x={1} y={sq[n]} attach="nw" attachDistance={8} size={12} color="var(--text)">W²</Label>
          <Label x={1} y={naive[n]} attach="sw" attachDistance={8} size={12} color="var(--c-put)">Σ 2W ΔW</Label>
        </PlotFrame>
      }
      controls={
        <>
          <Slider label="Steps $n$" value={power} min={3} max={16} onChange={setPower} format={(v) => (2 ** v).toLocaleString('en-US')} color="var(--c-time)" />
          <Button onClick={() => setSeed((s) => s + 1)}>New path</Button>
        </>
      }
      readout={
        <dl className="readout-grid">
          <dt>W(1)²</dt><dd>{sq[n].toFixed(4)}</dd>
          <dt>Ordinary chain rule, Σ 2W ΔW</dt><dd style={{ color: 'var(--c-put)' }}>{naive[n].toFixed(4)}</dd>
          <dt>Gap</dt><dd>{gap.toFixed(4)} <span className="muted">≈ t = 1 (Itô's correction)</span></dd>
        </dl>
      }
      caption="Thick line: W(t)². Red: what the ordinary chain rule d(W²) = 2W dW predicts, summed along the path. Green dashed: the same sum plus t, Itô's correction, which tracks W² exactly as the steps shrink."
    />
  );
}
