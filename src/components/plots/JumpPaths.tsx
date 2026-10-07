import { Point, Polyline } from 'mafs';
import { Fragment, useMemo, useState } from 'react';
import { mertonKbar, mertonPath, type MertonParams } from '../../lib/models/jumps';
import { Button, Slider } from '../ui/controls';
import { WidgetFrame } from '../ui/WidgetFrame';
import { extent, money, niceTicks } from './format';
import { PlotFrame } from './PlotFrame';

const N = 252, PATHS = 5;
const pct = (v: number) => `${v < 0 ? '−' : '+'}${Math.abs(v * 100).toFixed(1)}%`;

/**
 * Chapter 31: Merton jump-diffusion paths over one year of trading days. Jumps
 * are marked with dots; between them the paths are ordinary GBM.
 */
export default function JumpPaths() {
  const [lambda, setLambda] = useState(2);
  const [muJ, setMuJ] = useState(-0.1);
  const [delta, setDelta] = useState(0.05);
  const [seed, setSeed] = useState(1);
  const p: MertonParams = { sigma: 0.15, lambda, muJ, delta };
  const paths = useMemo(() => Array.from({ length: PATHS }, (_, i) => mertonPath(seed * 50 + i, 100, 0.07, p, 1, N)), [seed, lambda, muJ, delta]);
  const all = paths.flatMap((x) => x.S);
  const [lo, hi] = extent(all);
  const jumpsSeen = paths.reduce((a, x) => a + x.jumps.length, 0);

  return (
    <WidgetFrame
      title="Paths that jump"
      ariaLabel={`${PATHS} Merton paths over a year with ${jumpsSeen} jumps in total; jumps arrive ${lambda} times a year on average with mean size ${pct(mertonKbar(p))}.`}
      plotHeight={300}
      plot={
        <PlotFrame x={[0, 1]} y={[lo * 0.95, hi * 1.05]} height={300} xTicks={[0, 0.25, 0.5, 0.75, 1]} yTicks={niceTicks(lo * 0.95, hi * 1.05, 5)} formatX={(t) => (t === 0 ? 'today' : `${Math.round(t * 12)} mo`)} formatY={(v) => money(v, 0)} yLabel="stock price">
          {paths.map((x, k) => (
            <Fragment key={k}>
              <Polyline points={x.S.map((s, i) => [i / N, s] as [number, number])} color="var(--c-spot)" weight={1.5} strokeOpacity={0.8} fillOpacity={0} />
              {x.jumps.map((i) => <Point key={i} x={i / N} y={x.S[i]} color={x.S[i] < x.S[i - 1] ? 'var(--c-put)' : 'var(--c-call)'} />)}
            </Fragment>
          ))}
        </PlotFrame>
      }
      controls={
        <>
          <Button onClick={() => setSeed((s) => s + 1)}>New paths</Button>
          <Slider label="Jumps per year λ" value={lambda} min={0} max={10} step={0.5} onChange={setLambda} format={(v) => v.toFixed(1)} color="var(--c-put)" />
          <Slider label="Average jump μ_J" value={muJ} min={-0.3} max={0.15} step={0.01} onChange={setMuJ} format={pct} color="var(--c-put)" />
          <Slider label="Jump size spread δ" value={delta} min={0} max={0.2} step={0.01} onChange={setDelta} format={(v) => `${Math.round(v * 100)}%`} color="var(--c-put)" />
        </>
      }
      readout={
        <dl className="readout-grid">
          <dt>Jumps in these {PATHS} paths</dt><dd>{jumpsSeen} <span className="muted">(expected {(lambda * PATHS).toFixed(1)})</span></dd>
          <dt>Mean move per jump</dt><dd>{pct(mertonKbar(p))}</dd>
        </dl>
      }
      caption="Merton's model: 15% diffusion volatility plus jumps that arrive at random (a Poisson process) and multiply the price by $e^J$, with $J$ normal. Red dots mark down-jumps, green up-jumps."
    />
  );
}
