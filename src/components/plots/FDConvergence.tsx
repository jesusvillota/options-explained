import { Polyline } from 'mafs';
import { useMemo } from 'react';
import { interpolate, solveBlackScholesPDE } from '../../lib/numerics/finiteDifference';
import { DEFAULTS, price } from '../../lib/pricing/blackScholes';
import { WidgetFrame } from '../ui/WidgetFrame';
import { Label, PlotFrame } from './PlotFrame';

const STEPS = [5, 10, 20, 40, 80];
const SCHEMES = [
  { theta: 1, rannacher: false, label: 'implicit', color: 'var(--c-rate)' },
  { theta: 0.5, rannacher: false, label: 'Crank–Nicolson', color: 'var(--text-muted)' },
  { theta: 0.5, rannacher: true, label: 'CN + Rannacher', color: 'var(--c-vol)' },
];
const sup = (n: number) => `${n < 0 ? '⁻' : ''}${String(Math.abs(n)).split('').map((d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[Number(d)]).join('')}`;

/**
 * Chapter 34: the time-discretisation error at S = 100 against the number of
 * time steps, on log–log axes, with a fine price grid. Implicit falls with
 * slope −1, Crank–Nicolson with Rannacher start-up with slope −2; plain
 * Crank–Nicolson stumbles at coarse steps because of the payoff's kink.
 */
export default function FDConvergence() {
  const exact = price('call', DEFAULTS);
  const lines = useMemo(
    () => SCHEMES.map(({ theta, rannacher }) => STEPS.map((nT) => {
      const r = solveBlackScholesPDE({ type: 'call', K: 100, r: 0.05, sigma: 0.2, T: 1, nS: 800, Smax: 400, nT, theta, rannacher });
      return [Math.log10(nT), Math.log10(Math.abs(interpolate(r.S, r.V[nT], 100) - exact))] as [number, number];
    })),
    [exact],
  );

  return (
    <WidgetFrame
      title="How fast the error falls"
      ariaLabel="Error of three finite-difference schemes against the number of time steps, log–log: implicit has slope −1, Crank–Nicolson with Rannacher start-up slope −2."
      plotHeight={280}
      plot={
        <PlotFrame x={[Math.log10(4), Math.log10(100)]} y={[-4, 0]} height={280} xTicks={STEPS.map(Math.log10)} yTicks={[-4, -3, -2, -1, 0]} formatX={(v) => String(Math.round(10 ** v))} formatY={(v) => (v === 0 ? '1' : `10${sup(v)}`)} xLabel="time steps (log scale)" yLabel="|error| at S = $100 (log scale)" marginLeft={50}>
          {lines.map((pts, i) => <Polyline key={i} points={pts} color={SCHEMES[i].color} weight={2.5} fillOpacity={0} />)}
          {/* Labels where the lines are well separated: implicit at the right, the two Crank–Nicolson lines at the left. */}
          <Label x={lines[0][4][0]} y={lines[0][4][1]} attach="nw" attachDistance={8} size={12} color={SCHEMES[0].color}>{SCHEMES[0].label}</Label>
          <Label x={lines[1][1][0]} y={lines[1][1][1]} attach="ne" attachDistance={8} size={12} color={SCHEMES[1].color}>{SCHEMES[1].label}</Label>
          <Label x={lines[2][1][0]} y={lines[2][1][1]} attach="sw" attachDistance={8} size={12} color={SCHEMES[2].color}>{SCHEMES[2].label}</Label>
        </PlotFrame>
      }
      caption="Price grid of 800 steps of \$0.50, fine enough that the time steps dominate the error. Every halving of Δτ halves the implicit error and quarters the Crank–Nicolson + Rannacher error."
    />
  );
}
