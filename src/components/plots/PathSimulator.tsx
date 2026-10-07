import { Polyline } from 'mafs';
import { useMemo, useState } from 'react';
import { brownianPath, scaledRandomWalk } from '../../lib/math/brownian';
import { Button, Segmented, Slider } from '../ui/controls';
import { WidgetFrame } from '../ui/WidgetFrame';
import { Label, PlotFrame } from './PlotFrame';

type Mode = 'walk' | 'bm';
const HEIGHT = 340;
const band = (k: number) => Array.from({ length: 101 }, (_, i) => [i / 100, k * Math.sqrt(i / 100)] as [number, number]);

/**
 * Chapter 15: many scaled random walks (±√Δt coin flips) or Brownian paths,
 * with the ±√t and ±2√t bands that contain about 68% and 95% of them at each time.
 */
export default function PathSimulator() {
  const [mode, setMode] = useState<Mode>('walk');
  const [power, setPower] = useState(4);
  const [count, setCount] = useState(12);
  const [seed, setSeed] = useState(1);
  const n = 2 ** power;
  const paths = useMemo(
    () => Array.from({ length: count }, (_, k) => (mode === 'walk' ? scaledRandomWalk(seed * 1000 + k, n) : brownianPath(seed * 1000 + k, n))),
    [mode, n, count, seed],
  );
  const inside = paths.filter((p) => Math.abs(p[n]) <= 1).length;

  const plot = (
    <PlotFrame x={[0, 1]} y={[-3.2, 3.2]} height={HEIGHT} xTicks={[0, 0.25, 0.5, 0.75, 1]} yTicks={[-3, -2, -1, 0, 1, 2, 3]} formatX={(t) => `t = ${t}`} formatY={(v) => String(v)} baseline={0} yLabel="W(t)">
      {[1, -1].map((s) => <Polyline key={`b1${s}`} points={band(s)} color="var(--c-time)" weight={2} strokeStyle="dashed" fillOpacity={0} />)}
      {[2, -2].map((s) => <Polyline key={`b2${s}`} points={band(s)} color="var(--c-time)" weight={1.5} strokeStyle="dashed" strokeOpacity={0.5} fillOpacity={0} />)}
      <Label x={1} y={1} attach="w" attachDistance={6} size={12} color="var(--c-time)">+√t</Label>
      <Label x={1} y={2} attach="w" attachDistance={6} size={12} color="var(--c-time)">+2√t</Label>
      {paths.map((p, k) => (
        <Polyline key={k} points={p.map((v, i) => [i / n, v] as [number, number])} color="var(--c-spot)" weight={count > 20 ? 1 : 1.6} strokeOpacity={count > 20 ? 0.45 : 0.75} fillOpacity={0} />
      ))}
    </PlotFrame>
  );

  return (
    <WidgetFrame
      title={mode === 'walk' ? 'Coin-flip walks, shrinking the steps' : 'Brownian paths'}
      ariaLabel={`${count} ${mode === 'walk' ? 'random walks' : 'Brownian paths'} with ${n} steps on [0, 1], inside dashed bands at ±√t and ±2√t.`}
      plotHeight={HEIGHT}
      plot={plot}
      controls={
        <>
          <Segmented label="Kind of path" value={mode} onChange={setMode} options={[
            { value: 'walk', label: 'Coin flips ±√Δt' },
            { value: 'bm', label: 'Brownian motion' },
          ]} />
          <Button onClick={() => setSeed((s) => s + 1)}>New paths</Button>
          <Slider label="Steps $n$" value={power} min={1} max={11} onChange={setPower} format={(v) => String(2 ** v)} color="var(--c-time)" />
          <Slider label="Number of paths" value={count} min={1} max={60} onChange={setCount} format={String} color="var(--c-spot)" />
        </>
      }
      readout={
        <p>
          {n} steps of size ±{Math.sqrt(1 / n).toFixed(3)} (that's √Δt with Δt = 1/{n}). At t = 1, {inside} of {count} paths ended inside ±1, where about 68% should
          land.
        </p>
      }
      caption="Each coin-flip step moves ±√Δt. As the steps shrink, the walks become indistinguishable from Brownian motion, and the spread at time t is always about √t."
    />
  );
}
