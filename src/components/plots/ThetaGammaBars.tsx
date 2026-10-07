import { Line, MovablePoint, Point, Polyline } from 'mafs';
import { useState } from 'react';
import { DEFAULTS, greeks } from '../../lib/pricing/blackScholes';
import { thetaGammaSplit } from '../../lib/pricing/hedging';
import { Slider } from '../ui/controls';
import { WidgetFrame } from '../ui/WidgetFrame';
import { clamp, signedMoney } from './format';
import { Label, PlotFrame } from './PlotFrame';

const DT = 1 / 252;

/**
 * Chapter 22: one day in the life of a delta-hedged long call. The gamma gain
 * ½ΓS²(move)² is a parabola in the day's move; the theta cost is a fixed
 * drop. The cost is theta net of financing, so they
 * break even exactly at a move of σ√dt, the move the option's price "expects".
 */
export default function ThetaGammaBars() {
  const [sigma, setSigma] = useState(0.2);
  const [tau, setTau] = useState(0.25);
  const [move, setMove] = useState(0.02);
  const input = { ...DEFAULTS, sigma, T: tau };
  const g = greeks('call', input);
  const split = thetaGammaSplit('call', input, move, DT);
  const be = split.breakevenMove;
  const curve = (m: number) => thetaGammaSplit('call', input, m, DT).net;
  const ms = Array.from({ length: 121 }, (_, i) => -0.04 + (i * 0.08) / 120);
  const yMax = Math.max(curve(0.04), Math.abs(split.thetaCost) * 2) * 1.1;
  const yMin = split.thetaCost * 1.6;

  return (
    <WidgetFrame
      title="A day of gamma vs theta"
      ariaLabel={`Delta-hedged long call: theta costs ${signedMoney(split.thetaCost)} a day; gamma earns ${signedMoney(split.gammaGain)} on a ${(move * 100).toFixed(1)}% move; breakeven at ±${(be * 100).toFixed(2)}%.`}
      plotHeight={300}
      plot={
        <PlotFrame x={[-0.04, 0.04]} y={[yMin, yMax]} height={300} xTicks={[-0.04, -0.02, 0, 0.02, 0.04]} yTicks={[]} formatX={(v) => `${(v * 100).toFixed(0)}%`} baseline={0} xLabel="today's stock move" yLabel="one day's P&L of the hedged call">
          <Line.Segment point1={[-0.04, split.thetaCost]} point2={[0.04, split.thetaCost]} color="var(--c-put)" style="dashed" weight={1.5} />
          <Label x={-0.039} y={split.thetaCost} attach="se" attachDistance={6} size={12} color="var(--c-put)">theta: what you pay every day</Label>
          <Polyline points={ms.map((m) => [m, curve(m)] as [number, number])} color="var(--c-call)" weight={3.5} fillOpacity={0} />
          <Point x={be} y={0} color="var(--c-vol)" />
          <Point x={-be} y={0} color="var(--c-vol)" />
          <Label x={be} y={0} attach="se" attachDistance={8} size={12} color="var(--c-vol)">±σ√dt = {(be * 100).toFixed(2)}%</Label>
          <Line.Segment point1={[move, 0]} point2={[move, curve(move)]} color="var(--c-spot)" style="dashed" weight={1.5} />
          <MovablePoint point={[move, curve(move)]} color="var(--c-spot)" onMove={([x]) => setMove(Math.round(clamp(x, -0.04, 0.04) * 1000) / 1000)} constrain={([x]) => { const m = clamp(x, -0.04, 0.04); return [m, curve(m)]; }} />
        </PlotFrame>
      }
      controls={
        <>
          <Slider label="Today's move" value={move} min={-0.04} max={0.04} step={0.001} onChange={setMove} format={(v) => `${(v * 100).toFixed(1)}%`} color="var(--c-spot)" />
          <Slider label="Implied volatility $\Vol{\sigma}$" value={sigma} min={0.05} max={0.6} step={0.01} onChange={setSigma} format={(v) => `${Math.round(v * 100)}%`} color="var(--c-vol)" />
          <Slider label="Time to expiry $\Time{\tau}$" value={tau} min={0.05} max={1} step={0.05} onChange={setTau} format={(v) => `${v.toFixed(2)} yr`} color="var(--c-time)" />
        </>
      }
      readout={
        <dl className="readout-grid">
          <dt>Gamma gain ½ΓS²·move²</dt><dd className="good">{signedMoney(split.gammaGain, 3)}</dd>
          <dt>Theta cost (net of financing)</dt><dd className="bad">{signedMoney(split.thetaCost, 3)}</dd>
          <dt>Net for the day</dt><dd className={split.net >= 0 ? 'good' : 'bad'}>{signedMoney(split.net, 3)}</dd>
          <dt>Breakeven daily move</dt><dd>±{(be * 100).toFixed(2)}% <span className="muted">= σ/√252 (Γ = {g.gamma.toFixed(4)})</span></dd>
        </dl>
      }
      caption="One trading day for a long at-the-money call, hedged with Δ shares. The parabola is the gamma profit from the day's move; the dashed level is the theta paid regardless, net of interest on the hedge, ½σ²S²Γ·dt. Moves bigger than the breakeven make money."
    />
  );
}
