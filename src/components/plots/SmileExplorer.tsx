import { Line, Polyline } from 'mafs';
import { useState } from 'react';
import { logMoneynessForDelta, smileQuotes, ssviButterflyFree, ssviTotalVariance, ssviVol, type SSVIParams } from '../../lib/vol/smile';
import { Segmented, Slider } from '../ui/controls';
import { WidgetFrame } from '../ui/WidgetFrame';
import { Heatmap } from './Heatmap';
import { Label, PlotFrame } from './PlotFrame';

type View = 'smiles' | 'surface';
type Axis = 'strike' | 'k' | 'delta';
type Preset = 'equity' | 'fx' | 'commodity' | 'flat';

const PRESETS: Record<Preset, Required<SSVIParams>> = {
  equity: { atmVol: 0.2, atmVolShort: 0.2, rho: -0.6, eta: 0.8 },
  fx: { atmVol: 0.1, atmVolShort: 0.1, rho: 0, eta: 1.2 },
  commodity: { atmVol: 0.3, atmVolShort: 0.3, rho: 0.4, eta: 0.8 },
  flat: { atmVol: 0.2, atmVolShort: 0.2, rho: 0, eta: 0 },
};
const MATURITIES = [1 / 12, 0.25, 0.5, 1, 2];
const MAT_LABEL = ['1 month', '3 months', '6 months', '1 year', '2 years'];
const S = 100, r = 0.05;
const HEIGHT = 320;
const pct = (v: number) => `${Math.round(v * 100)}%`;
const pts = (v: number) => `${v >= 0 ? '+' : '−'}${Math.abs(v * 100).toFixed(1)}`;

/**
 * Chapter 26: implied volatility across strikes and maturities from an SSVI
 * surface. Smiles view: one curve per maturity, against strike, log-moneyness
 * or delta. Surface view: the whole σ(K, T) as a colour map.
 */
export default function SmileExplorer() {
  const [view, setView] = useState<View>('smiles');
  const [axis, setAxis] = useState<Axis>('strike');
  const [preset, setPreset] = useState<Preset | 'custom'>('equity');
  const [p, setP] = useState<Required<SSVIParams>>(PRESETS.equity);
  const set = (patch: Partial<SSVIParams>) => { setP((old) => ({ ...old, ...patch })); setPreset('custom'); };
  const choose = (name: Preset | 'custom') => { if (name !== 'custom') { setP(PRESETS[name]); setPreset(name); } };

  const fwd = (T: number) => S * Math.exp(r * T);
  const xRange: Record<Axis, [number, number]> = { strike: [60, 150], k: [-0.5, 0.4], delta: [0.05, 0.95] };
  const [x0, x1] = xRange[axis];
  // Log-moneyness for a plotted x at maturity T.
  const kOf = (x: number, T: number) => {
    if (axis === 'strike') return Math.log(x / fwd(T));
    if (axis === 'k') return x;
    return logMoneynessForDelta(1 - x, (k) => ssviTotalVariance(k, T, p));
  };
  const curves = MATURITIES.map((T) => Array.from({ length: 91 }, (_, i) => {
    const x = x0 + ((x1 - x0) * i) / 90;
    return [x, ssviVol(kOf(x, T), T, p)] as [number, number];
  }));
  const yMax = Math.min(Math.max(...curves.flat().map(([, v]) => v), 0.25) * 1.12, 1);
  const quotes = smileQuotes(0.25, p);
  const arbFree = MATURITIES.every((T) => ssviButterflyFree(p, T));
  const xTicks: Record<Axis, number[]> = { strike: [60, 80, 100, 120, 140], k: [-0.4, -0.2, 0, 0.2, 0.4], delta: [0.1, 0.25, 0.5, 0.75, 0.9] };
  const formatX: Record<Axis, (v: number) => string> = {
    strike: (v) => `$${v}`,
    k: (v) => (v === 0 ? '0' : v.toFixed(1)),
    delta: (v) => (v === 0.5 ? 'ATM' : v < 0.5 ? `${Math.round(v * 100)}Δp` : `${Math.round((1 - v) * 100)}Δc`),
  };
  const xLabel: Record<Axis, string> = { strike: 'strike K (stock $100)', k: 'log-moneyness k = ln(K/F)', delta: 'put delta ← → call delta' };

  const smiles = (
    <PlotFrame x={[x0, x1]} y={[0, yMax]} height={HEIGHT} xTicks={xTicks[axis]} yTicks={[0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9].filter((t) => t <= yMax)} formatX={formatX[axis]} formatY={pct} xLabel={xLabel[axis]} yLabel="implied volatility">
      {axis !== 'strike' && <Line.Segment point1={[axis === 'k' ? 0 : 0.5, 0]} point2={[axis === 'k' ? 0 : 0.5, yMax]} color="var(--text-muted)" style="dashed" weight={1} />}
      {axis === 'strike' && <Line.Segment point1={[S, 0]} point2={[S, yMax]} color="var(--c-spot)" style="dashed" weight={1} />}
      {curves.map((c, i) => (
        <Polyline key={i} points={c} color="var(--c-vol)" weight={i === 1 ? 3.5 : 2} strokeOpacity={0.35 + (0.65 * (MATURITIES.length - i)) / MATURITIES.length} fillOpacity={0} />
      ))}
      <Label x={curves[0][0][0]} y={curves[0][0][1]} attach="se" attachDistance={6} size={12} color="var(--c-vol)">{MAT_LABEL[0]}</Label>
      <Label x={x1} y={curves[4][90][1]} attach="nw" attachDistance={6} size={12} color="var(--c-vol)">{MAT_LABEL[4]}</Label>
    </PlotFrame>
  );

  // Colour scale from the lowest vol to the 95th percentile, so one extreme corner doesn't wash out the rest.
  const sample = Array.from({ length: 30 * 20 }, (_, i) => ssviVol(Math.log((60 + 3 * (i % 30)) / fwd(0.05 + 0.1 * Math.floor(i / 30))), 0.05 + 0.1 * Math.floor(i / 30), p)).sort((a, b) => a - b);
  const colourRange: [number, number] = [sample[0], Math.max(sample[Math.floor(0.95 * sample.length)], sample[0] + 0.01)];
  const surface = (
    <Heatmap
      f={(K, T) => ssviVol(Math.log(K / fwd(T)), T, p)}
      range={colourRange}
      x={[60, 150]}
      y={[0.05, 2]}
      height={HEIGHT}
      color="--c-vol"
      xTicks={[60, 80, 100, 120, 140]}
      yTicks={[0.5, 1, 1.5, 2]}
      formatX={(K) => `$${Math.round(K)}`}
      formatY={(T) => `${T.toFixed(1)} yr`}
      formatValue={(v) => `${(v * 100).toFixed(1)}%`}
      xLabel="strike K"
      yLabel="implied volatility σ(K, T)"
      nx={90}
      ny={60}
    />
  );

  return (
    <WidgetFrame
      title={view === 'smiles' ? 'Volatility smiles' : 'The volatility surface'}
      ariaLabel={`Implied volatility smiles for maturities from 1 month to 2 years. Three-month at-the-money ${pct(quotes.atm)}, 25-delta risk reversal ${pts(quotes.rr25)} points, butterfly ${pts(quotes.bf25)} points.`}
      plotHeight={HEIGHT}
      plot={view === 'smiles' ? smiles : surface}
      controls={
        <>
          <Segmented label="Market" value={preset} onChange={choose} options={[
            { value: 'equity', label: 'Equity index' },
            { value: 'fx', label: 'Currency' },
            { value: 'commodity', label: 'Commodity' },
            { value: 'flat', label: 'Black–Scholes' },
          ]} />
          <Segmented label="View" value={view} onChange={setView} options={[
            { value: 'smiles', label: 'Smiles' },
            { value: 'surface', label: 'Surface' },
          ]} />
          {view === 'smiles' && (
            <Segmented label="Horizontal axis" value={axis} onChange={setAxis} options={[
              { value: 'strike', label: 'Strike' },
              { value: 'k', label: 'Log-moneyness' },
              { value: 'delta', label: 'Delta' },
            ]} />
          )}
          <Slider label="Long-dated ATM vol" value={p.atmVol} min={0.05} max={0.6} step={0.01} onChange={(v) => set({ atmVol: v })} format={pct} color="var(--c-vol)" />
          <Slider label="Short-dated ATM vol" value={p.atmVolShort} min={0.05} max={0.8} step={0.01} onChange={(v) => set({ atmVolShort: v })} format={pct} color="var(--c-vol)" />
          <Slider label="Skew ρ" value={p.rho} min={-0.95} max={0.95} step={0.05} onChange={(v) => set({ rho: v })} format={(v) => v.toFixed(2)} color="var(--c-vol)" />
          <Slider label="Wings η" value={p.eta} min={0} max={2.5} step={0.05} onChange={(v) => set({ eta: v })} format={(v) => v.toFixed(2)} color="var(--c-vol)" />
        </>
      }
      readout={
        <dl className="readout-grid">
          <dt>3-month ATM vol</dt><dd>{(quotes.atm * 100).toFixed(1)}%</dd>
          <dt>25Δ risk reversal</dt><dd>{pts(quotes.rr25)} pts <span className="muted">(skew: calls minus puts)</span></dd>
          <dt>25Δ butterfly</dt><dd>{pts(quotes.bf25)} pts <span className="muted">(curvature: wings minus ATM)</span></dd>
          <dt>Butterfly arbitrage</dt><dd className={arbFree ? 'good' : 'bad'}>{arbFree ? 'none (SSVI conditions hold)' : 'possible: the wings are too steep'}</dd>
        </dl>
      }
      caption="An SSVI surface (Gatheral and Jacquier): one at-the-money term structure, one skew ρ and one wing parameter η describe every maturity. The thick curve is 3 months; fainter curves are longer-dated."
    />
  );
}
