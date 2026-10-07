import { Line, Point, Polyline } from 'mafs';
import { useMemo, useState } from 'react';
import { c } from '../../lib/math/complex';
import { invCdf } from '../../lib/math/normal';
import { blackScholesCF, type CharFn } from '../../lib/models/fourier';
import { HESTON_DEFAULTS, hestonCF, hestonPath } from '../../lib/models/heston';
import { MERTON_DEFAULTS, mertonCF, mertonPath } from '../../lib/models/jumps';
import { Segmented, Slider } from '../ui/controls';
import { WidgetFrame } from '../ui/WidgetFrame';
import { useElementWidth } from './animation';
import { Label, PlotFrame } from './PlotFrame';

type Model = 'bs' | 'heston' | 'merton';
const SAMPLES = 120;
const HEIGHT = 320;

/** Sample log-returns X = ln(S_T/F) (zero rates, so F = S₀): quantiles for Black–Scholes, seeded paths otherwise. */
function samples(model: Model, T: number): number[] {
  if (model === 'bs') return Array.from({ length: SAMPLES }, (_, i) => -0.02 * T + 0.2 * Math.sqrt(T) * invCdf((i + 0.5) / SAMPLES));
  return Array.from({ length: SAMPLES }, (_, i) => {
    const S = model === 'heston' ? hestonPath(i + 1, 100, 0, HESTON_DEFAULTS, T, 40).S : mertonPath(i + 1, 100, 0, MERTON_DEFAULTS, T, 40).S;
    return Math.log(S[S.length - 1] / 100);
  });
}

const CF: Record<Model, (T: number) => CharFn> = {
  bs: (T) => blackScholesCF(0.2, T),
  heston: (T) => hestonCF(HESTON_DEFAULTS, T),
  merton: (T) => mertonCF(MERTON_DEFAULTS, T),
};
const LABEL: Record<Model, string> = { bs: 'Black–Scholes', heston: 'Heston', merton: 'Merton jumps' };

/**
 * Chapter 35: what a characteristic function is. Each possible log-return X
 * becomes a unit arrow at angle uX; φ(u) is their average. As u grows, the
 * arrows fan out round the circle and the average shrinks towards zero.
 */
export default function CharFnArrows() {
  const [model, setModel] = useState<Model>('bs');
  const [T, setT] = useState(1);
  const [u, setU] = useState(3);
  const xs = useMemo(() => samples(model, T), [model, T]);
  const phi = useMemo(() => CF[model](T), [model, T]);
  const tips = xs.map((x) => [Math.cos(u * x), Math.sin(u * x)] as [number, number]);
  const avg: [number, number] = [tips.reduce((a, p) => a + p[0], 0) / SAMPLES, tips.reduce((a, p) => a + p[1], 0) / SAMPLES];
  const z = phi(c(u));
  // Keep the unit circle round: widen the x-range to match the plot's aspect ratio
  // (PlotFrame's margins are 78px horizontally and 58px vertically).
  const [box, width] = useElementWidth<HTMLDivElement>();
  const aspect = width > 0 ? Math.max((width - 78) / (HEIGHT - 58), 1) : 1;
  const half = 1.15 * aspect;
  const trace = Array.from({ length: 121 }, (_, i) => { const w = phi(c((u * i) / 120)); return [w.re, w.im] as [number, number]; });

  return (
    <WidgetFrame
      title="A characteristic function is an average of arrows"
      ariaLabel={`${LABEL[model]}, T = ${T}: at u = ${u}, the ${SAMPLES} arrows average to ${avg[0].toFixed(2)} + ${avg[1].toFixed(2)}i; the exact φ(u) is ${z.re.toFixed(2)} + ${z.im.toFixed(2)}i.`}
      plotHeight={HEIGHT}
      plot={
        <div ref={box}>
        <PlotFrame x={[-half, half]} y={[-1.15, 1.15]} height={HEIGHT} xTicks={[-2, -1, 0, 1, 2].filter((t) => Math.abs(t) < half)} yTicks={[-1, 0, 1]} formatX={(v) => String(v)} formatY={(v) => String(v)} xLabel="real part" yLabel="imaginary part">
          <Polyline points={Array.from({ length: 121 }, (_, i) => [Math.cos((2 * Math.PI * i) / 120), Math.sin((2 * Math.PI * i) / 120)] as [number, number])} color="var(--text-muted)" weight={1} strokeStyle="dashed" fillOpacity={0} />
          {tips.map((p, i) => <Line.Segment key={i} point1={[0, 0]} point2={p} color="var(--c-prob)" weight={1} opacity={0.18} />)}
          <Polyline points={trace} color="var(--c-vol)" weight={1.5} strokeStyle="dashed" fillOpacity={0} />
          <Line.Segment point1={[0, 0]} point2={avg} color="var(--c-vol)" weight={3.5} />
          <Point x={z.re} y={z.im} color="var(--c-strike)" />
          <Label x={avg[0]} y={avg[1]} attach="ne" attachDistance={8} size={12} color="var(--c-vol)">average = φ({u})</Label>
        </PlotFrame>
        </div>
      }
      controls={
        <>
          <Segmented label="Model" value={model} onChange={setModel} options={(Object.keys(LABEL) as Model[]).map((k) => ({ value: k, label: LABEL[k] }))} />
          <Slider label="Frequency u" value={u} min={0} max={30} step={0.25} onChange={setU} format={(v) => v.toFixed(2)} color="var(--c-vol)" />
          <Slider label="Maturity $\Time{T}$" value={T} min={0.05} max={3} step={0.05} onChange={setT} format={(v) => `${v.toFixed(2)} yr`} color="var(--c-time)" />
        </>
      }
      readout={
        <dl className="readout-grid">
          <dt>Average of {SAMPLES} arrows</dt><dd>{avg[0].toFixed(3)} {avg[1] < 0 ? '−' : '+'} {Math.abs(avg[1]).toFixed(3)}i</dd>
          <dt>Exact φ(u) (yellow dot)</dt><dd>{z.re.toFixed(3)} {z.im < 0 ? '−' : '+'} {Math.abs(z.im).toFixed(3)}i <span className="muted">|φ| = {Math.hypot(z.re, z.im).toFixed(3)}</span></dd>
        </dl>
      }
      caption="Each faint arrow is one possible log-return $X$, drawn at angle $uX$ on the unit circle. The thick arrow is their average; the dashed curve traces the exact $\varphi$ from $0$ to $u$. Wider distributions fan out sooner, so $\varphi$ shrinks faster."
    />
  );
}
