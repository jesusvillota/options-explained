import { Line, Polyline } from 'mafs';
import { useMemo, useState } from 'react';
import { fellerHolds, hestonSmile, hestonVarianceSwap, type HestonParams } from '../../lib/models/heston';
import { Segmented, Slider } from '../ui/controls';
import { WidgetFrame } from '../ui/WidgetFrame';
import { Label, PlotFrame } from './PlotFrame';

type Preset = 'equity' | 'symmetric' | 'flat';
const PRESETS: Record<Preset, HestonParams> = {
  equity: { v0: 0.04, kappa: 2, theta: 0.04, xi: 0.5, rho: -0.7 },
  symmetric: { v0: 0.04, kappa: 2, theta: 0.04, xi: 0.5, rho: 0 },
  flat: { v0: 0.04, kappa: 2, theta: 0.04, xi: 0.01, rho: 0 },
};
const S = 100, r = 0.03;
const MATS = [1 / 12, 0.25, 1];
const MAT_LABEL = ['1 month', '3 months', '1 year'];
const STRIKES = Array.from({ length: 41 }, (_, i) => 60 + 2 * i);
const HEIGHT = 300;
const pct = (v: number, d = 1) => `${(v * 100).toFixed(d)}%`;

/**
 * Chapter 30: the Heston model's implied volatility smiles for three
 * maturities, priced live with the characteristic function. Correlation tilts
 * the smile; vol of vol curves it; mean reversion flattens it with maturity.
 */
export default function HestonSmile() {
  const [preset, setPreset] = useState<Preset | 'custom'>('equity');
  const [p, setP] = useState<HestonParams>(PRESETS.equity);
  const set = (patch: Partial<HestonParams>) => { setP((o) => ({ ...o, ...patch })); setPreset('custom'); };
  const smiles = useMemo(() => MATS.map((T) => hestonSmile(p, S, STRIKES, T, r)), [p]);
  // Drop strikes where the price is too close to its bounds to invert (deep wings of the 1-month smile).
  const curves = smiles.map((vols, j) =>
    STRIKES.map((K, i) => [K, vols[i]] as [number, number]).filter(([K, v]) => Number.isFinite(v) && v > 0.01 && v < 1.5 && (MATS[j] > 0.1 || Math.abs(K - S) <= 30)),
  );
  const all = curves.flat().map(([, v]) => v);
  const yLo = Math.max(Math.min(...all, Math.sqrt(p.v0), Math.sqrt(p.theta)) - 0.03, 0);
  const yHi = Math.max(...all, Math.sqrt(p.v0), Math.sqrt(p.theta)) + 0.03;
  const at = (j: number, K: number) => smiles[j][STRIKES.indexOf(K)];
  const skew3m = at(1, 90) - at(1, 110);
  const skew1y = at(2, 90) - at(2, 110);
  const feller = fellerHolds(p);

  return (
    <WidgetFrame
      title="Heston smiles"
      ariaLabel={`Heston implied volatility smiles at 1 month, 3 months and 1 year. 3-month 90–110 skew ${pct(skew3m)}, 1-year ${pct(skew1y)}. Feller condition ${feller ? 'holds' : 'fails'}.`}
      plotHeight={HEIGHT}
      plot={
        <PlotFrame x={[60, 140]} y={[yLo, yHi]} height={HEIGHT} xTicks={[60, 80, 100, 120, 140]} yTicks={[0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6].filter((t) => t > yLo && t < yHi)} formatX={(v) => `$${v}`} formatY={(v) => `${Math.round(v * 100)}%`} xLabel="strike K (spot $100)" yLabel="implied volatility">
          <Line.Segment point1={[60, Math.sqrt(p.v0)]} point2={[140, Math.sqrt(p.v0)]} color="var(--text-muted)" style="dashed" weight={1} />
          {curves.map((c, j) => <Polyline key={j} points={c} color="var(--c-vol)" weight={j === 1 ? 3.5 : 2} strokeOpacity={j === 0 ? 1 : j === 1 ? 0.8 : 0.45} fillOpacity={0} />)}
          {curves[0].length > 0 && <Label x={curves[0][0][0]} y={curves[0][0][1]} attach="ne" attachDistance={6} size={12} color="var(--c-vol)">{MAT_LABEL[0]}</Label>}
          {curves[2].length > 0 && <Label x={140} y={curves[2][curves[2].length - 1][1]} attach="nw" attachDistance={6} size={12} color="var(--c-vol)">{MAT_LABEL[2]}</Label>}
          <Label x={140} y={Math.sqrt(p.v0)} attach="sw" attachDistance={4} size={11} color="var(--text-muted)">√v₀</Label>
        </PlotFrame>
      }
      controls={
        <>
          <Segmented label="Preset" value={preset} onChange={(v) => { if (v !== 'custom') { setP(PRESETS[v]); setPreset(v); } }} options={[
            { value: 'equity', label: 'Equity (ρ < 0)' },
            { value: 'symmetric', label: 'ρ = 0' },
            { value: 'flat', label: 'No vol of vol' },
          ]} />
          <Slider label="Correlation ρ" value={p.rho} min={-0.95} max={0.95} step={0.05} onChange={(v) => set({ rho: v })} format={(v) => v.toFixed(2)} color="var(--c-vol)" />
          <Slider label="Vol of vol ξ" value={p.xi} min={0.01} max={1.5} step={0.01} onChange={(v) => set({ xi: v })} format={(v) => v.toFixed(2)} color="var(--c-vol)" />
          <Slider label="Mean reversion κ" value={p.kappa} min={0.1} max={6} step={0.1} onChange={(v) => set({ kappa: v })} format={(v) => v.toFixed(1)} color="var(--c-time)" />
          <Slider label="Current vol √v₀" value={Math.sqrt(p.v0)} min={0.08} max={0.5} step={0.01} onChange={(v) => set({ v0: v * v })} format={(v) => pct(v, 0)} color="var(--c-vol)" />
          <Slider label="Long-run vol √θ" value={Math.sqrt(p.theta)} min={0.08} max={0.5} step={0.01} onChange={(v) => set({ theta: v * v })} format={(v) => pct(v, 0)} color="var(--c-vol)" />
        </>
      }
      readout={
        <dl className="readout-grid">
          <dt>Skew σ(90) − σ(110)</dt><dd>{pct(skew3m)} at 3 months, {pct(skew1y)} at 1 year</dd>
          <dt>1-year variance-swap vol</dt><dd>{pct(Math.sqrt(hestonVarianceSwap(p, 1)))}</dd>
          <dt>Feller condition 2κθ ≥ ξ²</dt><dd className={feller ? 'good' : 'bad'}>{feller ? 'holds: variance stays positive' : 'fails: variance can touch zero'}</dd>
        </dl>
      }
      caption="Each smile is priced from Heston's characteristic function by Fourier integration and converted to Black–Scholes implied volatility. Dashed: the current volatility $\sqrt{v_0}$. Thick: 3 months."
    />
  );
}
