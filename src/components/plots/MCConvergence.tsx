import { Line, Polygon, Polyline } from 'mafs';
import { useMemo, useState } from 'react';
import { mcEuropean, type Technique } from '../../lib/numerics/monteCarlo';
import { DEFAULTS, price } from '../../lib/pricing/blackScholes';
import type { OptionType } from '../../lib/pricing/payoff';
import { Button, Segmented, Slider } from '../ui/controls';
import { WidgetFrame } from '../ui/WidgetFrame';
import { money, niceTicks } from './format';
import { Label, PlotFrame } from './PlotFrame';

const TOTAL = 100000;
const HEIGHT = 300;
const pow10 = (e: number) => (e === 0 ? '1' : `10${'⁰¹²³⁴⁵⁶⁷⁸⁹'[e]}`);

/**
 * Chapter 33: a Monte Carlo price converging as the number of simulations
 * grows (log scale), with its ±2 standard-error band and the exact
 * Black–Scholes value.
 */
export default function MCConvergence() {
  const [technique, setTechnique] = useState<Technique>('plain');
  const [type, setType] = useState<OptionType>('call');
  const [K, setK] = useState(100);
  const [seed, setSeed] = useState(1);
  const input = { ...DEFAULTS, K };
  const res = useMemo(() => mcEuropean(type, input, TOTAL, seed, technique, 60), [type, K, seed, technique]); // input derives from K
  const exact = price(type, input);
  const pts = res.n.map((n, i) => [Math.log10(n), res.estimate[i]] as [number, number]);
  const upper = res.n.map((n, i) => [Math.log10(n), res.estimate[i] + 2 * res.stdError[i]] as [number, number]);
  const lower = res.n.map((n, i) => [Math.log10(n), res.estimate[i] - 2 * res.stdError[i]] as [number, number]);
  // Frame the plot around ±4 standard errors at N ≈ 200; earlier wanderings may leave the frame.
  const refSE = res.stdError[Math.max(res.n.findIndex((n) => n >= 200), 0)];
  const yLo = exact - Math.max(4 * refSE, 0.05), yHi = exact + Math.max(4 * refSE, 0.05);
  const last = res.n.length - 1;
  const x0 = Math.log10(res.n[0]), x1 = Math.log10(TOTAL);

  return (
    <WidgetFrame
      title="A Monte Carlo price converging"
      ariaLabel={`${technique} Monte Carlo for a ${type} struck at ${K}: after ${TOTAL.toLocaleString('en-US')} simulations the estimate is ${money(res.estimate[last], 3)} ± ${money(2 * res.stdError[last], 3)}; Black–Scholes gives ${money(exact, 3)}.`}
      plotHeight={HEIGHT}
      plot={
        <PlotFrame x={[x0, x1]} y={[yLo, yHi]} height={HEIGHT} xTicks={[2, 3, 4, 5].filter((t) => t >= x0)} yTicks={niceTicks(yLo, yHi, 5)} formatX={(v) => `${pow10(Math.round(v))}`} formatY={(v) => money(v)} xLabel="number of simulations (log scale)" yLabel="estimated price" marginLeft={56}>
          <Polygon points={[...upper, ...lower.slice().reverse()].map(([x, y]) => [x, Math.min(Math.max(y, yLo), yHi)] as [number, number])} color="var(--c-vol)" fillOpacity={0.18} strokeOpacity={0} />
          <Line.Segment point1={[x0, exact]} point2={[x1, exact]} color="var(--c-strike)" style="dashed" weight={1.5} />
          <Polyline points={pts.map(([x, y]) => [x, Math.min(Math.max(y, yLo), yHi)] as [number, number])} color="var(--c-vol)" weight={2.5} fillOpacity={0} />
          <Label x={x1} y={exact} attach="nw" attachDistance={6} size={12} color="var(--c-strike)">Black–Scholes {money(exact, 3)}</Label>
        </PlotFrame>
      }
      controls={
        <>
          <Segmented label="Technique" value={technique} onChange={setTechnique} options={[
            { value: 'plain', label: 'Plain' },
            { value: 'antithetic', label: 'Antithetic' },
            { value: 'control', label: 'Control variate' },
          ]} />
          <Segmented label="Option" value={type} onChange={setType} options={[
            { value: 'call', label: 'Call' },
            { value: 'put', label: 'Put' },
          ]} />
          <Button onClick={() => setSeed((s) => s + 1)}>New random numbers</Button>
          <Slider label="Strike $\Strike{K}$" value={K} min={60} max={160} step={5} onChange={setK} format={(v) => money(v, 0)} color="var(--c-strike)" />
        </>
      }
      readout={
        <dl className="readout-grid">
          <dt>Estimate after {TOTAL.toLocaleString('en-US')}</dt><dd>{money(res.estimate[last], 4)} <span className="muted">± {money(2 * res.stdError[last], 4)} (95%)</span></dd>
          <dt>Actual error</dt><dd>{money(Math.abs(res.estimate[last] - exact), 4)} <span className="muted">= {(Math.abs(res.estimate[last] - exact) / res.stdError[last]).toFixed(1)} standard errors</span></dd>
        </dl>
      }
      caption="S = \$100, one year, $\Rate{r} = 5\%$, $\Vol{\sigma} = 20\%$. The shaded band is the estimate ± 2 standard errors, computed from the samples themselves. It narrows like $1/\sqrt{N}$: each extra correct digit costs a hundred times more simulations."
    />
  );
}
