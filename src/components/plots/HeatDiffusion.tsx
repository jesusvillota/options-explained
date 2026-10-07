import { Polyline } from 'mafs';
import { useEffect, useMemo, useRef, useState } from 'react';
import { interpolate, solveBlackScholesPDE } from '../../lib/numerics/finiteDifference';
import { DEFAULTS, price } from '../../lib/pricing/blackScholes';
import { payoff, type OptionType } from '../../lib/pricing/payoff';
import { Button, Segmented, Slider } from '../ui/controls';
import { WidgetFrame } from '../ui/WidgetFrame';
import { usePrefersReducedMotion } from './animation';
import { money } from './format';
import { Label, PlotFrame } from './PlotFrame';

const T_MAX = 2;
const N_T = 200;
const X: [number, number] = [40, 180];

/**
 * Chapter 19: solve the Black–Scholes PDE backwards from the payoff with
 * Crank–Nicolson. As time-to-expiry τ grows, the kink diffuses away like heat.
 * The dashed curve is the closed-form solution: they agree.
 */
export default function HeatDiffusion() {
  const [type, setType] = useState<OptionType>('call');
  const [sigma, setSigma] = useState(0.3);
  const [k, setK] = useState(0);
  const [playing, setPlaying] = useState(false);
  const reduced = usePrefersReducedMotion();
  const fd = useMemo(() => solveBlackScholesPDE({ type, K: 100, r: DEFAULTS.r, sigma, T: T_MAX, nS: 300, nT: N_T, Smax: 300 }), [type, sigma]);
  const kRef = useRef(k);
  kRef.current = k;
  useEffect(() => {
    if (!playing) return;
    if (reduced) { setK(N_T); setPlaying(false); return; }
    const start = performance.now();
    const from = kRef.current;
    let frame = 0;
    const tick = (now: number) => {
      const next = Math.min(N_T, from + Math.round(((now - start) / 4000) * N_T));
      setK(next);
      if (next < N_T) frame = requestAnimationFrame(tick);
      else setPlaying(false);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, reduced]);

  const tau = (k / N_T) * T_MAX;
  const xs = Array.from({ length: 141 }, (_, i) => X[0] + i);
  const fdCurve = xs.map((s) => [s, interpolate(fd.S, fd.V[k], s)] as [number, number]);
  const bsCurve = xs.map((s) => [s, tau > 0 ? price(type, { ...DEFAULTS, S: s, sigma, T: tau }) : payoff(type, s, 100)] as [number, number]);
  const maxErr = Math.max(...xs.map((_, i) => Math.abs(fdCurve[i][1] - bsCurve[i][1])));
  const color = type === 'call' ? 'var(--c-call)' : 'var(--c-put)';

  return (
    <WidgetFrame
      title="The payoff diffuses backwards in time"
      ariaLabel={`Solution of the Black–Scholes PDE at ${tau.toFixed(2)} years to expiry; finite differences and the formula differ by at most ${money(maxErr)}.`}
      plotHeight={330}
      plot={
        <PlotFrame x={X} y={[-3, 85]} height={330} xTicks={[40, 60, 80, 100, 120, 140, 160, 180]} yTicks={[0, 20, 40, 60, 80]} formatX={(v) => `$${v}`} formatY={(v) => `$${v}`} baseline={0} xLabel="stock price S" yLabel="option value V(S, τ)">
          <Polyline points={xs.map((s) => [s, payoff(type, s, 100)] as [number, number])} color="var(--text-muted)" weight={1.5} strokeStyle="dashed" fillOpacity={0} />
          <Polyline points={fdCurve} color={color} weight={4} fillOpacity={0} />
          <Polyline points={bsCurve} color="var(--text)" weight={1.5} strokeStyle="dashed" fillOpacity={0} />
          <Label x={X[0] + 4} y={78} attach="e" attachDistance={0} size={13} color="var(--c-time)">τ = {tau.toFixed(2)} years to expiry</Label>
        </PlotFrame>
      }
      controls={
        <>
          <Button onClick={() => (k >= N_T ? setK(0) : setPlaying(true))} disabled={playing}>{k >= N_T ? 'Reset' : 'Play ▶'}</Button>
          <Segmented label="Option type" value={type} onChange={setType} options={[
            { value: 'call', label: 'Call', color: 'var(--c-call)' },
            { value: 'put', label: 'Put', color: 'var(--c-put)' },
          ]} />
          <Slider label="Time to expiry $\Time{\tau}$" value={k} min={0} max={N_T} onChange={(v) => { setPlaying(false); setK(v); }} format={() => `${tau.toFixed(2)} yr`} color="var(--c-time)" />
          <Slider label="Volatility $\Vol{\sigma}$" value={sigma} min={0.05} max={0.6} step={0.01} onChange={setSigma} format={(v) => `${Math.round(v * 100)}%`} color="var(--c-vol)" />
        </>
      }
      readout={
        <p>
          Finite-difference solution of the PDE (thick) vs the Black–Scholes formula (dashed): largest gap {money(maxErr, 4)}. At $100 the option is worth{' '}
          <strong className="num" style={{ color }}>{money(interpolate(fd.S, fd.V[k], 100))}</strong>.
        </p>
      }
      caption="Start at expiry (τ = 0): the value is the payoff, kink and all. Solving the PDE backwards in time smooths the kink exactly the way heat spreads out from a hot spot."
    />
  );
}
