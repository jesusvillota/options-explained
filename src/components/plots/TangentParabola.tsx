import { Line, MovablePoint, Point, Polyline } from 'mafs';
import { useState } from 'react';
import { DEFAULTS, greeks, price } from '../../lib/pricing/blackScholes';
import { payoff, type OptionType } from '../../lib/pricing/payoff';
import { Segmented, Slider } from '../ui/controls';
import { WidgetFrame } from '../ui/WidgetFrame';
import { clamp, money, signedMoney } from './format';
import { Label, PlotFrame } from './PlotFrame';

const X: [number, number] = [50, 150];

/**
 * Chapter 21: delta is the slope of the price curve, gamma its curvature.
 * Top: the price, its tangent line and its osculating parabola at S. Bottom:
 * delta across stock prices. Readout: how well each approximation predicts a move.
 */
export default function TangentParabola() {
  const [type, setType] = useState<OptionType>('call');
  const [S0, setS0] = useState(100);
  const [tau, setTau] = useState(0.5);
  const [move, setMove] = useState(10);
  const input = (S: number) => ({ ...DEFAULTS, S, T: tau });
  const V = (S: number) => price(type, input(S));
  const g = greeks(type, input(S0));
  const v0 = V(S0);
  const xs = Array.from({ length: 101 }, (_, i) => X[0] + i);
  const tangent = (S: number) => v0 + g.delta * (S - S0);
  const parabola = (S: number) => tangent(S) + 0.5 * g.gamma * (S - S0) ** 2;
  const color = type === 'call' ? 'var(--c-call)' : 'var(--c-put)';
  const actual = V(S0 + move) - v0;
  const d1 = g.delta * move;
  const d2 = d1 + 0.5 * g.gamma * move * move;

  const top = (
    <PlotFrame x={X} y={[-5, 55]} height={280} xTicks={[50, 75, 100, 125, 150]} yTicks={[0, 25, 50]} formatX={(v) => `$${v}`} formatY={(v) => `$${v}`} baseline={0} yLabel="option value">
      <Polyline points={xs.map((S) => [S, payoff(type, S, 100)] as [number, number])} color="var(--text-muted)" weight={1.2} strokeStyle="dashed" fillOpacity={0} />
      <Polyline points={xs.map((S) => [S, V(S)] as [number, number])} color={color} weight={4} fillOpacity={0} />
      <Polyline points={xs.map((S) => [S, parabola(S)] as [number, number])} color="var(--c-vol)" weight={2} strokeStyle="dashed" fillOpacity={0} />
      <Line.Segment point1={[X[0], tangent(X[0])]} point2={[X[1], tangent(X[1])]} color="var(--c-spot)" weight={2} />
      <Line.Segment point1={[S0 + move, Math.min(V(S0 + move), tangent(S0 + move))]} point2={[S0 + move, Math.max(V(S0 + move), tangent(S0 + move))]} color="var(--c-rate)" weight={3} />
      <Point x={S0 + move} y={V(S0 + move)} color={color} />
      <Label x={S0 + move} y={V(S0 + move)} attach={type === 'call' ? 'nw' : 'ne'} attachDistance={10} size={12} color="var(--c-rate)">after the move</Label>
      <MovablePoint point={[S0, v0]} color="var(--c-spot)" onMove={([x]) => setS0(Math.round(clamp(x, 60, 140)))} constrain={([x]) => { const s = clamp(x, 60, 140); return [s, V(s)]; }} />
    </PlotFrame>
  );
  const bottom = (
    <div style={{ borderTop: '1px solid var(--border)' }}>
      <PlotFrame x={X} y={type === 'call' ? [-0.05, 1.05] : [-1.05, 0.05]} height={160} xTicks={[50, 75, 100, 125, 150]} yTicks={type === 'call' ? [0, 0.5, 1] : [-1, -0.5, 0]} formatX={(v) => `$${v}`} formatY={(v) => v.toFixed(1)} baseline={0} yLabel="delta Δ(S)">
        <Polyline points={xs.map((S) => [S, greeks(type, input(S)).delta] as [number, number])} color="var(--c-spot)" weight={3} fillOpacity={0} />
        <Point x={S0} y={g.delta} color="var(--c-spot)" />
      </PlotFrame>
    </div>
  );

  return (
    <WidgetFrame
      title="Slope and curvature"
      ariaLabel={`At S = ${S0}, the ${type} has delta ${g.delta.toFixed(3)} and gamma ${g.gamma.toFixed(4)}.`}
      plotHeight={440}
      plot={<>{top}{bottom}</>}
      controls={
        <>
          <Segmented label="Option type" value={type} onChange={setType} options={[
            { value: 'call', label: 'Call', color: 'var(--c-call)' },
            { value: 'put', label: 'Put', color: 'var(--c-put)' },
          ]} />
          <Slider label="Stock price $\Spot{S}$" value={S0} min={60} max={140} onChange={setS0} format={(v) => `$${v}`} color="var(--c-spot)" />
          <Slider label="Time to expiry $\Time{\tau}$" value={tau} min={0.02} max={2} step={0.02} onChange={setTau} format={(v) => `${v.toFixed(2)} yr`} color="var(--c-time)" />
          <Slider label="Size of the stock move" value={move} min={-20} max={20} onChange={setMove} format={(v) => signedMoney(v, 0)} color="var(--c-rate)" />
        </>
      }
      readout={
        <dl className="readout-grid">
          <dt>Delta Δ (slope)</dt><dd>{g.delta.toFixed(4)}</dd>
          <dt>Gamma Γ (curvature)</dt><dd>{g.gamma.toFixed(4)}</dd>
          <dt>Actual change for {signedMoney(move, 0)}</dt><dd>{signedMoney(actual)}</dd>
          <dt>Delta only: Δ·dS</dt><dd style={{ color: 'var(--c-spot)' }}>{signedMoney(d1)} <span className="muted">(error {money(Math.abs(actual - d1))})</span></dd>
          <dt>Delta + gamma: + ½Γ·dS²</dt><dd style={{ color: 'var(--c-vol)' }}>{signedMoney(d2)} <span className="muted">(error {money(Math.abs(actual - d2))})</span></dd>
        </dl>
      }
      caption="Blue line: the tangent (delta). Purple dashed: the parabola that also matches the curvature (gamma). Orange: the gap between the tangent and the real price after a move, which is what gamma captures."
    />
  );
}
