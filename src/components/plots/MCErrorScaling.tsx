import { Polyline } from 'mafs';
import { useMemo, useState } from 'react';
import { mcEuropean, type Technique } from '../../lib/numerics/monteCarlo';
import { DEFAULTS } from '../../lib/pricing/blackScholes';
import { Slider } from '../ui/controls';
import { WidgetFrame } from '../ui/WidgetFrame';
import { Label, PlotFrame } from './PlotFrame';

const TOTAL = 100000;
const TECHS: { t: Technique; label: string; color: string }[] = [
  { t: 'plain', label: 'plain', color: 'var(--text)' },
  { t: 'antithetic', label: 'antithetic', color: 'var(--c-call)' },
  { t: 'control', label: 'control variate', color: 'var(--c-vol)' },
];
const pow10 = (e: number) => (e === 0 ? '1' : `10${'⁰¹²³⁴⁵⁶⁷⁸⁹'[e]}`);
const pow10neg = (e: number) => `10⁻${'⁰¹²³⁴⁵⁶⁷⁸⁹'[-e]}`;

/**
 * Chapter 33: standard error against the number of simulations on log–log
 * axes. Every technique has slope −½ (the 1/√N law); variance reduction only
 * shifts the line down.
 */
export default function MCErrorScaling() {
  const [K, setK] = useState(100);
  const lines = useMemo(() => TECHS.map(({ t }) => mcEuropean('call', { ...DEFAULTS, K }, TOTAL, 5, t, 30)), [K]);
  const pts = lines.map((res) => res.n.map((n, i) => [Math.log10(n), Math.log10(res.stdError[i])] as [number, number]).filter(([, y]) => Number.isFinite(y)));
  const lastSE = lines.map((res) => res.stdError[res.stdError.length - 1]);
  const factor = (i: number) => (lastSE[0] / lastSE[i]) ** 2;
  const ys = pts.flat().map(([, y]) => y);
  const yLo = Math.floor(Math.min(...ys)), yHi = Math.ceil(Math.max(...ys));

  return (
    <WidgetFrame
      title="Error against effort"
      ariaLabel={`Standard error of a Monte Carlo call price against simulations, log–log. Variance reduction factors: antithetic ${factor(1).toFixed(1)}, control variate ${factor(2).toFixed(1)}.`}
      plotHeight={280}
      plot={
        <PlotFrame x={[1.2, 5]} y={[yLo, yHi]} height={280} xTicks={[2, 3, 4, 5]} yTicks={Array.from({ length: yHi - yLo + 1 }, (_, i) => yLo + i)} formatX={(v) => pow10(Math.round(v))} formatY={(v) => (v >= 0 ? pow10(v) : pow10neg(v))} xLabel="number of simulations (log scale)" yLabel="standard error (log scale)" marginLeft={50}>
          {pts.map((p, i) => <Polyline key={i} points={p} color={TECHS[i].color} weight={2.5} fillOpacity={0} />)}
          {pts.map((p, i) => p.length > 0 && <Label key={`l${i}`} x={p[p.length - 1][0]} y={p[p.length - 1][1]} attach="nw" attachDistance={6} size={12} color={TECHS[i].color}>{TECHS[i].label}</Label>)}
        </PlotFrame>
      }
      controls={<Slider label="Strike $\Strike{K}$" value={K} min={60} max={160} step={5} onChange={setK} format={(v) => `$${v}`} color="var(--c-strike)" />}
      readout={
        <dl className="readout-grid">
          <dt>Variance reduction vs plain</dt><dd>antithetic ×{factor(1).toFixed(1)}, control variate ×{factor(2).toFixed(1)}</dd>
          <dt>Meaning</dt><dd>{`a control variate does with N simulations what plain Monte Carlo needs ${factor(2) < 10 ? factor(2).toFixed(1) : Math.round(factor(2))}N for`}</dd>
        </dl>
      }
      caption="Call price, one year, $\Vol{\sigma} = 20\%$. All three lines fall with slope −½: halving the error always costs four times the work. Variance reduction lowers the line, it doesn't steepen it."
    />
  );
}
