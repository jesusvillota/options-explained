import { Line, Polyline } from 'mafs';
import { useMemo, useState } from 'react';
import { fellerHolds, hestonPath, type HestonParams } from '../../lib/models/heston';
import { Button, Slider } from '../ui/controls';
import { WidgetFrame } from '../ui/WidgetFrame';
import { extent, money, niceTicks } from './format';
import { Label, PlotFrame } from './PlotFrame';

const N = 504; // two years of trading days
const T = 2;

/**
 * Chapter 30: one Heston path, with the stock on top and its instantaneous
 * volatility √v below. With negative correlation, sell-offs and volatility
 * spikes come together; mean reversion pulls the volatility back to √θ.
 */
export default function HestonPaths() {
  const [rho, setRho] = useState(-0.7);
  const [xi, setXi] = useState(0.5);
  const [kappa, setKappa] = useState(2);
  const [seed, setSeed] = useState(3);
  const p: HestonParams = { v0: 0.04, theta: 0.04, kappa, xi, rho };
  const path = useMemo(() => hestonPath(seed, 100, 0.06, p, T, N), [seed, rho, xi, kappa]);
  const vol = path.v.map(Math.sqrt);
  const [lo, hi] = extent(path.S);
  const vMax = Math.max(...vol, 0.3) * 1.1;
  const t = (i: number) => (i / N) * T;
  const zeros = path.v.filter((v) => v <= 1e-6).length;

  const top = (
    <PlotFrame x={[0, T]} y={[lo * 0.95, hi * 1.05]} height={170} xTicks={[0, 0.5, 1, 1.5, 2]} yTicks={niceTicks(lo * 0.95, hi * 1.05, 4)} formatX={(v) => `${v} yr`} formatY={(v) => money(v, 0)} yLabel="stock price">
      <Polyline points={path.S.map((s, i) => [t(i), s] as [number, number])} color="var(--c-spot)" weight={1.6} fillOpacity={0} />
    </PlotFrame>
  );
  const bottom = (
    <div style={{ borderTop: '1px solid var(--border)' }}>
      <PlotFrame x={[0, T]} y={[0, vMax]} height={170} xTicks={[0, 0.5, 1, 1.5, 2]} yTicks={niceTicks(0, vMax, 4)} formatX={(v) => `${v} yr`} formatY={(v) => `${Math.round(v * 100)}%`} yLabel="volatility √v">
        <Line.Segment point1={[0, 0.2]} point2={[T, 0.2]} color="var(--text-muted)" style="dashed" weight={1} />
        <Polyline points={vol.map((v, i) => [t(i), v] as [number, number])} color="var(--c-vol)" weight={1.6} fillOpacity={0} />
        <Label x={T} y={0.2} attach="nw" attachDistance={4} size={11} color="var(--text-muted)">√θ = 20%</Label>
      </PlotFrame>
    </div>
  );

  return (
    <WidgetFrame
      title="A Heston path and its volatility"
      ariaLabel={`Two years of a Heston path with correlation ${rho}, vol of vol ${xi}, mean reversion ${kappa}. Volatility ranges from ${Math.round(Math.min(...vol) * 100)}% to ${Math.round(Math.max(...vol) * 100)}%.`}
      plotHeight={340}
      plot={<>{top}{bottom}</>}
      controls={
        <>
          <Button onClick={() => setSeed((s) => s + 1)}>New path</Button>
          <Slider label="Correlation ρ" value={rho} min={-0.95} max={0.95} step={0.05} onChange={setRho} format={(v) => v.toFixed(2)} color="var(--c-vol)" />
          <Slider label="Vol of vol ξ" value={xi} min={0.05} max={1.5} step={0.05} onChange={setXi} format={(v) => v.toFixed(2)} color="var(--c-vol)" />
          <Slider label="Mean reversion κ" value={kappa} min={0.2} max={8} step={0.2} onChange={setKappa} format={(v) => v.toFixed(1)} color="var(--c-time)" />
        </>
      }
      readout={
        <dl className="readout-grid">
          <dt>Volatility range</dt><dd>{Math.round(Math.min(...vol) * 100)}% to {Math.round(Math.max(...vol) * 100)}%</dd>
          <dt>Feller 2κθ ≥ ξ²</dt><dd className={fellerHolds(p) ? 'good' : 'bad'}>{fellerHolds(p) ? 'holds' : `fails: variance hit zero on ${zeros} days`}</dd>
        </dl>
      }
      caption="Simulated daily with full-truncation Euler, starting at 20% volatility with long-run level 20%. The same random numbers are reused as you move the sliders, so you can see each parameter's effect on one path."
    />
  );
}
