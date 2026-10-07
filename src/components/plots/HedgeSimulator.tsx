import { Line, Polyline } from 'mafs';
import { useMemo, useState } from 'react';
import { DEFAULTS, greeks } from '../../lib/pricing/blackScholes';
import { simulateHedge } from '../../lib/pricing/hedging';
import { Button, Segmented, Slider } from '../ui/controls';
import { WidgetFrame } from '../ui/WidgetFrame';
import { extent, money, niceTicks, signedMoney } from './format';
import { Label, PlotFrame } from './PlotFrame';

type Freq = '12' | '52' | '252' | '1000';
const PATHS = 400;

/**
 * Chapter 24: sell a call at the implied volatility and delta-hedge it at a
 * chosen frequency while the stock moves with its realised volatility. Top: one
 * path's running P&L. Bottom: the histogram of final P&L across many paths.
 */
export default function HedgeSimulator() {
  const [freq, setFreq] = useState<Freq>('52');
  const [implied, setImplied] = useState(0.2);
  const [realised, setRealised] = useState(0.2);
  const [seed, setSeed] = useState(1);
  const steps = Number(freq);
  const res = useMemo(
    () => simulateHedge({ type: 'call', S0: 100, K: 100, T: 1, r: 0.05, impliedVol: implied, realisedVol: realised, mu: 0.08, steps, paths: PATHS, seed }),
    [steps, implied, realised, seed],
  );
  const mean = res.pnl.reduce((a, b) => a + b, 0) / PATHS;
  const sd = Math.sqrt(res.pnl.reduce((a, b) => a + (b - mean) ** 2, 0) / PATHS);
  const vega = greeks('call', { ...DEFAULTS, sigma: implied }).vega;
  const ruleSd = Math.sqrt(Math.PI / 4) * vega * realised / Math.sqrt(steps);
  const ruleMean = vega * (implied - realised);
  const [lo, hi] = extent(res.pnl);
  // Fit the histogram to the data, always keeping zero in view.
  const pad = 0.05 * Math.max(hi - lo, 1);
  const xLo = Math.min(lo, 0) - pad, xHi = Math.max(hi, 0) + pad;
  const bins = 30;
  const w = (xHi - xLo) / bins;
  const hist = new Array<number>(bins).fill(0);
  for (const x of res.pnl) hist[Math.min(Math.floor((x - xLo) / w), bins - 1)]++;
  const hMax = Math.max(...hist);
  const [plo, phi] = extent(res.sample.pnl);
  const pspan = Math.max(Math.abs(plo), Math.abs(phi), 0.5) * 1.15;

  const top = (
    <PlotFrame x={[0, 1]} y={[-pspan, pspan]} height={180} xTicks={[0, 0.25, 0.5, 0.75, 1]} yTicks={niceTicks(-pspan, pspan, 4)} formatX={(t) => (t === 0 ? 'sold' : t === 1 ? 'expiry' : `${Math.round(t * 12)} mo`)} formatY={(v) => signedMoney(v, 1)} baseline={0} yLabel="one path: running P&L">
      <Polyline points={res.sample.t.map((t, i) => [t, res.sample.pnl[i]] as [number, number])} color="var(--c-spot)" weight={2} fillOpacity={0} />
    </PlotFrame>
  );
  const bottom = (
    <div style={{ borderTop: '1px solid var(--border)' }}>
      <PlotFrame x={[xLo, xHi]} y={[0, hMax * 1.15]} height={200} xTicks={niceTicks(xLo, xHi, 5)} yTicks={[]} formatX={(v) => signedMoney(v, 1)} xLabel={`final P&L of ${PATHS} hedged paths`}>
        {hist.map((h, b) => (
          <Line.Segment key={b} point1={[xLo + (b + 0.5) * w, 0]} point2={[xLo + (b + 0.5) * w, h]} color={xLo + (b + 0.5) * w >= 0 ? 'var(--c-call)' : 'var(--c-put)'} weight={10} opacity={0.6} />
        ))}
        <Line.Segment point1={[mean, 0]} point2={[mean, hMax * 1.1]} color="var(--text)" style="dashed" weight={2} />
        <Label x={mean} y={hMax * 1.08} attach={mean > (xLo + xHi) / 2 ? "w" : "e"} attachDistance={6} size={12} color="var(--text)">mean {signedMoney(mean)}</Label>
      </PlotFrame>
    </div>
  );

  return (
    <WidgetFrame
      title="Delta-hedging simulator"
      ariaLabel={`Selling a call for ${money(res.premium)} and hedging ${steps} times a year: mean P&L ${signedMoney(mean)}, standard deviation ${money(sd)}.`}
      plotHeight={380}
      plot={<>{top}{bottom}</>}
      controls={
        <>
          <Segmented label="Rebalances per year" value={freq} onChange={setFreq} options={[
            { value: '12', label: 'monthly' },
            { value: '52', label: 'weekly' },
            { value: '252', label: 'daily' },
            { value: '1000', label: '4× a day' },
          ]} />
          <Button onClick={() => setSeed((s) => s + 1)}>Re-simulate</Button>
          <Slider label="Implied vol (sold at)" value={implied} min={0.1} max={0.4} step={0.01} onChange={setImplied} format={(v) => `${Math.round(v * 100)}%`} color="var(--c-vol)" />
          <Slider label="Realised vol (what happens)" value={realised} min={0.1} max={0.4} step={0.01} onChange={setRealised} format={(v) => `${Math.round(v * 100)}%`} color="var(--c-rate)" />
        </>
      }
      readout={
        <dl className="readout-grid">
          <dt>Premium received</dt><dd>{money(res.premium)}</dd>
          <dt>Mean final P&L</dt><dd className={mean >= 0 ? 'good' : 'bad'}>{signedMoney(mean)} <span className="muted">(rule of thumb vega·(σ_imp − σ_real) = {signedMoney(ruleMean)})</span></dd>
          <dt>Std. dev. of P&L</dt><dd>{money(sd)} <span className="muted">(rule of thumb √(π/4)·vega·σ/√N = {money(ruleSd)})</span></dd>
        </dl>
      }
      caption="A \$100 call, one year, sold at the implied volatility and delta-hedged at the chosen frequency while the stock follows GBM with the realised volatility (drift 8%: it doesn't matter)."
    />
  );
}
