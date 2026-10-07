import { Polyline } from 'mafs';
import { useMemo, useState } from 'react';
import { gbmPath } from '../../lib/math/rng';
import { DEFAULTS, price } from '../../lib/pricing/blackScholes';
import { arithmeticAsianMC, geometricAsian } from '../../lib/pricing/exotics';
import { Button, Segmented, Slider } from '../ui/controls';
import { WidgetFrame } from '../ui/WidgetFrame';
import { extent, money, niceTicks } from './format';
import { Label, PlotFrame } from './PlotFrame';

type Fixings = '4' | '12' | '52' | '252';
const PATHS = 20000;

/**
 * Chapter 38: an Asian call pays on the average price. Top: one path and its
 * running average, which wanders much less than the price. Readout: the
 * arithmetic Asian by Monte Carlo, plain and with the geometric Asian as a
 * control variate, against the closed-form geometric Asian and the vanilla.
 */
export default function AsianMC() {
  const [fixings, setFixings] = useState<Fixings>('12');
  const [sigma, setSigma] = useState(0.3);
  const [seed, setSeed] = useState(1);
  const n = Number(fixings);
  const input = { ...DEFAULTS, sigma };
  const res = useMemo(() => arithmeticAsianMC('call', { ...DEFAULTS, sigma }, n, PATHS, seed), [n, sigma, seed]);
  const path = useMemo(() => gbmPath(seed + 1000, 100, 0.05, sigma, 1, 252), [seed, sigma]);
  // Running average of the fixings seen so far.
  const step = 252 / n;
  const avg: [number, number][] = [];
  let sum = 0;
  for (let k = 1; k <= n; k++) {
    const i = Math.round(k * step);
    sum += path[i];
    avg.push([i / 252, sum / k]);
  }
  const [lo, hi] = extent(path);
  const geo = geometricAsian('call', input, n);
  const vanilla = price('call', input);

  return (
    <WidgetFrame
      title="Averaging makes options cheaper"
      ariaLabel={`Arithmetic Asian call with ${n} fixings and ${Math.round(sigma * 100)}% volatility: ${money(res.price, 3)} ± ${money(2 * res.stdError, 3)} by Monte Carlo with a control variate; vanilla ${money(vanilla, 3)}.`}
      plotHeight={240}
      plot={
        <PlotFrame x={[0, 1]} y={[lo * 0.97, hi * 1.03]} height={240} xTicks={[0, 0.25, 0.5, 0.75, 1]} yTicks={niceTicks(lo * 0.97, hi * 1.03, 4)} formatX={(v) => (v === 0 ? 'today' : `${Math.round(v * 12)} mo`)} formatY={(v) => money(v, 0)} yLabel="price and running average">
          <Polyline points={path.map((s, i) => [i / 252, s] as [number, number])} color="var(--c-spot)" weight={1.5} strokeOpacity={0.8} fillOpacity={0} />
          <Polyline points={[[0, 100], ...avg]} color="var(--c-call)" weight={3} fillOpacity={0} />
          <Label x={1} y={avg[avg.length - 1][1]} attach="nw" attachDistance={6} size={12} color="var(--c-call)">average of {n} fixings</Label>
        </PlotFrame>
      }
      controls={
        <>
          <Segmented label="Fixings per year" value={fixings} onChange={setFixings} options={[
            { value: '4', label: 'quarterly' },
            { value: '12', label: 'monthly' },
            { value: '52', label: 'weekly' },
            { value: '252', label: 'daily' },
          ]} />
          <Button onClick={() => setSeed((s) => s + 1)}>Re-simulate</Button>
          <Slider label="Volatility $\Vol{\sigma}$" value={sigma} min={0.1} max={0.6} step={0.01} onChange={setSigma} format={(v) => `${Math.round(v * 100)}%`} color="var(--c-vol)" />
        </>
      }
      readout={
        <dl className="readout-grid">
          <dt>Arithmetic Asian, control variate</dt><dd>{money(res.price, 4)} <span className="muted">± {money(2 * res.stdError, 4)}</span></dd>
          <dt>Arithmetic Asian, plain MC</dt><dd>{money(res.plain, 4)} <span className="muted">± {money(2 * res.plainStdError, 4)}</span></dd>
          <dt>Geometric Asian (closed form)</dt><dd>{money(geo, 4)}</dd>
          <dt>Vanilla call</dt><dd>{money(vanilla, 4)}</dd>
        </dl>
      }
      caption={`One-year at-the-money call on the average of the fixings, \\$100 strike, $\\Rate{r} = 5\\%$, ${PATHS.toLocaleString('en-US')} simulated paths. The ± is two standard errors. The control variate is the geometric Asian, whose price is known exactly.`}
    />
  );
}
