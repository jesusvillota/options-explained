import { Polyline } from 'mafs';
import { useMemo, useState } from 'react';
import { mertonLogDensity, mertonPrice, type MertonParams } from '../../lib/models/jumps';
import { impliedVol } from '../../lib/vol/impliedVol';
import { Segmented, Slider } from '../ui/controls';
import { WidgetFrame } from '../ui/WidgetFrame';
import { Label, PlotFrame } from './PlotFrame';

type Tenor = 'week' | 'month' | 'year';
const TENOR: Record<Tenor, number> = { week: 1 / 52, month: 1 / 12, year: 1 };
const MATS = [1 / 52, 1 / 12, 0.25, 1];
const MAT_LABEL = ['1 week', '1 month', '3 months', '1 year'];
const r = 0;
const MONEY = Array.from({ length: 41 }, (_, i) => 0.8 + i * 0.01);
const pct = (v: number) => (Math.abs(v) < 0.0005 ? "0.0%" : `${v < 0 ? "−" : ""}${Math.abs(v * 100).toFixed(1)}%`);

/**
 * Chapter 31: Merton jumps. Top: the density of the log-return over the chosen
 * horizon on a log scale, against a normal with the same variance. Bottom:
 * smiles for four maturities. Jumps make short-dated smiles steep, and the
 * effect fades with maturity as the jumps average out.
 */
export default function JumpSmile() {
  const [tenor, setTenor] = useState<Tenor>('month');
  const [lambda, setLambda] = useState(1);
  const [muJ, setMuJ] = useState(-0.08);
  const [delta, setDelta] = useState(0.06);
  const p: MertonParams = { sigma: 0.15, lambda, muJ, delta };
  const T = TENOR[tenor];
  const totalVar = p.sigma ** 2 + lambda * (muJ * muJ + delta * delta);

  const smiles = useMemo(() => MATS.map((Tm) => MONEY.map((m) => {
    const K = 100 * m;
    return [m, impliedVol('call', mertonPrice('call', 100, K, Tm, r, p), { S: 100, K, T: Tm, r }).sigma] as [number, number];
  }).filter(([, v]) => Number.isFinite(v) && v > 0.01)), [lambda, muJ, delta]); // p is derived from these

  const sd = Math.sqrt(totalVar * T);
  const xs = Array.from({ length: 201 }, (_, i) => -5 * sd + (10 * sd * i) / 200);
  const mean = xs.reduce((a, x) => a + x * mertonLogDensity(x, T, 0, p), 0) * (xs[1] - xs[0]);
  const floor = -4;
  const logd = (f: number) => Math.max(Math.log10(Math.max(f, 1e-300)), floor);
  const jump = xs.map((x) => [x, logd(mertonLogDensity(x, T, 0, p))] as [number, number]);
  const normal = xs.map((x) => [x, logd(Math.exp(-((x - mean) ** 2) / (2 * sd * sd)) / (sd * Math.sqrt(2 * Math.PI)))] as [number, number]);
  const top = Math.max(...jump.map(([, y]) => y), ...normal.map(([, y]) => y)) + 0.3;
  const all = smiles.flat().map(([, v]) => v);
  const vLo = Math.max(Math.min(...all) - 0.02, 0), vHi = Math.max(...all) + 0.02;
  const skewAt = (j: number) => {
    const s = smiles[j];
    const at = (m: number) => s.find(([x]) => Math.abs(x - m) < 1e-9)?.[1] ?? NaN;
    return at(0.95) - at(1.05);
  };

  const density = (
    <PlotFrame x={[xs[0], xs[200]]} y={[floor, top]} height={170} xTicks={[-4 * sd, -2 * sd, 0, 2 * sd, 4 * sd].map((v) => Math.round(v * 1000) / 1000)} yTicks={[]} formatX={(v) => `${v >= 0 ? '+' : '−'}${Math.abs(v * 100).toFixed(0)}%`} xLabel={`log-return over ${tenor === 'week' ? 'a week' : tenor === 'month' ? 'a month' : 'a year'} (log scale)`} yLabel="density">
      <Polyline points={normal} color="var(--text-muted)" weight={1.5} strokeStyle="dashed" fillOpacity={0} />
      <Polyline points={jump} color="var(--c-prob)" weight={2.5} fillOpacity={0} />
      <Label x={xs[200]} y={normal[200][1]} attach="nw" attachDistance={6} size={11} color="var(--text-muted)">normal</Label>
    </PlotFrame>
  );
  const smilePlot = (
    <div style={{ borderTop: '1px solid var(--border)' }}>
      <PlotFrame x={[0.8, 1.2]} y={[vLo, vHi]} height={190} xTicks={[0.8, 0.9, 1, 1.1, 1.2]} yTicks={[0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5].filter((t) => t > vLo && t < vHi)} formatX={(v) => `${Math.round(v * 100)}%`} formatY={(v) => `${Math.round(v * 100)}%`} xLabel="strike / spot" yLabel="implied vol">
        {smiles.map((s, j) => <Polyline key={j} points={s} color="var(--c-vol)" weight={j === 0 ? 3 : 2} strokeOpacity={1 - j * 0.22} fillOpacity={0} />)}
        {smiles[0].length > 8 && <Label x={smiles[0][8][0]} y={smiles[0][8][1]} attach="ne" attachDistance={6} size={11} color="var(--c-vol)">{MAT_LABEL[0]}</Label>}
        {smiles[3].length > 0 && <Label x={1.2} y={smiles[3][smiles[3].length - 1][1]} attach="nw" attachDistance={4} size={11} color="var(--c-vol)">{MAT_LABEL[3]}</Label>}
      </PlotFrame>
    </div>
  );

  return (
    <WidgetFrame
      title="Jumps: fat tails and short-dated skew"
      ariaLabel={`Merton jump model. 95–105 skew: ${pct(skewAt(0))} at one week, ${pct(skewAt(3))} at one year.`}
      plotHeight={360}
      plot={<>{density}{smilePlot}</>}
      controls={
        <>
          <Segmented label="Density horizon" value={tenor} onChange={setTenor} options={[
            { value: 'week', label: '1 week' },
            { value: 'month', label: '1 month' },
            { value: 'year', label: '1 year' },
          ]} />
          <Slider label="Jumps per year λ" value={lambda} min={0} max={5} step={0.1} onChange={setLambda} format={(v) => v.toFixed(1)} color="var(--c-put)" />
          <Slider label="Average jump μ_J" value={muJ} min={-0.25} max={0.15} step={0.01} onChange={setMuJ} format={(v) => `${v < 0 ? '−' : '+'}${Math.abs(v * 100).toFixed(0)}%`} color="var(--c-put)" />
          <Slider label="Jump size spread δ" value={delta} min={0.01} max={0.2} step={0.01} onChange={setDelta} format={(v) => `${Math.round(v * 100)}%`} color="var(--c-put)" />
        </>
      }
      readout={
        <dl className="readout-grid">
          <dt>Skew σ(95%) − σ(105%)</dt><dd>{MAT_LABEL.map((l, j) => `${pct(skewAt(j))} (${l})`).join(', ')}</dd>
          <dt>Total volatility</dt><dd>{pct(Math.sqrt(totalVar))} <span className="muted">= √(σ² + λ(μ_J² + δ²)), diffusion 15%</span></dd>
        </dl>
      }
      caption="Top: Merton's log-return density (a Poisson mixture of normals) against a normal with the same variance, on a logarithmic vertical scale so the tails are visible. Bottom: Merton smiles at 1 week, 1 month, 3 months and 1 year (thickest: 1 week)."
    />
  );
}
