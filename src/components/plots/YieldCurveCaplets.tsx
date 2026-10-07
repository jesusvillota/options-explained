import { Line, Polygon, Polyline } from 'mafs';
import { useState } from 'react';
import { annuity, capPrice, forwardRate, swapRate, swaption, zeroRate, type NelsonSiegel } from '../../lib/rates/curve';
import { Slider } from '../ui/controls';
import { WidgetFrame } from '../ui/WidgetFrame';
import { Label, PlotFrame } from './PlotFrame';

const TAU = 0.25, MAT = 5;
const pct = (v: number, d = 2) => `${(v * 100).toFixed(d)}%`;
const bp = (v: number) => `${Math.round(v * 10000)} bp`;

/**
 * Chapter 41: shape a Nelson–Siegel yield curve and price a 5-year quarterly
 * cap with Black-76. Top: zero rates and 3-month forward rates, with the cap
 * strike. Bottom: each caplet's price; the ones whose forward is above the
 * strike are in the money.
 */
export default function YieldCurveCaplets() {
  const [c, setC] = useState<NelsonSiegel>({ b0: 0.04, b1: -0.015, b2: 0.01, lambda: 2 });
  const [K, setK] = useState(0.035);
  const [vol, setVol] = useState(0.25);
  const ts = Array.from({ length: 101 }, (_, i) => 0.05 + (i * 9.95) / 100);
  const zero = ts.map((t) => [t, zeroRate(t, c)] as [number, number]);
  const fwd = ts.filter((t) => t + TAU <= 10).map((t) => [t, forwardRate(t, t + TAU, c)] as [number, number]);
  const cap = capPrice(K, MAT, TAU, vol, c);
  const floor = capPrice(K, MAT, TAU, vol, c, 'put');
  const S5 = swapRate(TAU, MAT, TAU, c);
  const swapValue = annuity(TAU, MAT, TAU, c) * (S5 - K);
  // A 1y × 4y quarterly payer swaption covers the same periods as the caplets fixing from year 1.
  const swpn = swaption('payer', K, 1, 4, TAU, vol, c);
  const sameCaplets = cap.caplets.filter((q) => q.start >= 1 - 1e-9).reduce((a, q) => a + q.price, 0);
  const rates = [...zero, ...fwd].map(([, v]) => v);
  const rLo = Math.min(0, Math.min(...rates, K) - 0.005), rHi = Math.max(...rates, K) + 0.012; // headroom for the axis label
  const maxCaplet = Math.max(...cap.caplets.map((q) => q.price), 1e-6);

  const curves = (
    <PlotFrame x={[0, 10]} y={[rLo, rHi]} height={180} xTicks={[0, 2, 4, 6, 8, 10]} yTicks={[0, 0.01, 0.02, 0.03, 0.04, 0.05, 0.06, 0.07, 0.08].filter((v) => v >= rLo && v <= rHi)} formatX={(v) => `${v}y`} formatY={(v) => `${Math.round(v * 100)}%`} yLabel="rates">
      <Polygon points={[[TAU, rLo], [MAT, rLo], [MAT, rHi], [TAU, rHi]]} color="var(--c-time)" fillOpacity={0.06} strokeOpacity={0} />
      <Line.Segment point1={[0, K]} point2={[10, K]} color="var(--c-strike)" style="dashed" weight={1.5} />
      <Polyline points={fwd} color="var(--c-rate)" weight={2} fillOpacity={0} />
      <Polyline points={zero} color="var(--c-spot)" weight={2.5} fillOpacity={0} />
      <Label x={10} y={zero[zero.length - 1][1]} attach="nw" attachDistance={6} size={12} color="var(--c-spot)">zero rate</Label>
      <Label x={10} y={fwd[fwd.length - 1][1]} attach="sw" attachDistance={6} size={12} color="var(--c-rate)">3m forward</Label>
      <Label x={0.1} y={K} attach="ne" attachDistance={4} size={12} color="var(--c-strike)">cap strike {pct(K)}</Label>
    </PlotFrame>
  );
  const caplets = (
    <div style={{ borderTop: '1px solid var(--border)' }}>
      <PlotFrame x={[0, 10]} y={[0, maxCaplet * 1.2]} height={150} xTicks={[0, 1, 2, 3, 4, 5]} yTicks={[]} formatX={(v) => `${v}y`} xLabel="caplet fixing date" yLabel="caplet prices">
        {cap.caplets.map((q) => (
          <Polygon key={q.start} points={[[q.start + 0.03, 0], [q.end - 0.03, 0], [q.end - 0.03, q.price], [q.start + 0.03, q.price]]} color={q.forward > K ? 'var(--c-call)' : 'var(--text-muted)'} fillOpacity={0.6} strokeOpacity={0.8} weight={1} />
        ))}
      </PlotFrame>
    </div>
  );

  return (
    <WidgetFrame
      title="Caps, floors and the yield curve"
      ariaLabel={`5-year cap at ${pct(K)} with ${Math.round(vol * 100)}% volatility: ${bp(cap.total)} of notional; floor ${bp(floor.total)}; 5-year swap rate ${pct(S5)}.`}
      plotHeight={330}
      plot={<>{curves}{caplets}</>}
      controls={
        <>
          <Slider label="Long-term level β₀" value={c.b0} min={0} max={0.08} step={0.0025} onChange={(v) => setC({ ...c, b0: v })} format={(v) => pct(v)} color="var(--c-spot)" />
          <Slider label="Slope β₁ (short − long)" value={c.b1} min={-0.04} max={0.04} step={0.0025} onChange={(v) => setC({ ...c, b1: v })} format={(v) => `${v >= 0 ? '+' : '−'}${pct(Math.abs(v))}`} color="var(--c-spot)" />
          <Slider label="Hump β₂" value={c.b2} min={-0.04} max={0.04} step={0.0025} onChange={(v) => setC({ ...c, b2: v })} format={(v) => `${v >= 0 ? '+' : '−'}${pct(Math.abs(v))}`} color="var(--c-spot)" />
          <Slider label="Cap strike K" value={K} min={0.005} max={0.08} step={0.0025} onChange={setK} format={(v) => pct(v)} color="var(--c-strike)" />
          <Slider label="Black volatility" value={vol} min={0.05} max={0.6} step={0.01} onChange={setVol} format={(v) => `${Math.round(v * 100)}%`} color="var(--c-vol)" />
        </>
      }
      readout={
        <dl className="readout-grid">
          <dt>5-year cap / floor</dt><dd>{bp(cap.total)} / {bp(floor.total)} <span className="muted">of notional</span></dd>
          <dt>Cap − floor</dt><dd>{bp(cap.total - floor.total)} <span className="muted">= payer swap at the strike, {bp(swapValue)}</span></dd>
          <dt>5-year swap rate</dt><dd>{pct(S5)}</dd>
          <dt>1y × 4y payer swaption</dt><dd>{bp(swpn)} <span className="muted">vs {bp(sameCaplets)} for the caplets on the same periods</span></dd>
        </dl>
      }
      caption="Quarterly caplets on 3-month rates, the first period excluded because it's already fixed. Each caplet is Black-76 on its forward rate, discounted from its payment date. Green bars: forward above the strike."
    />
  );
}
