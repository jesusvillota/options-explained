import { Line, Plot, Point, Polygon, Polyline } from 'mafs';
import { useMemo, useState } from 'react';
import { AC_DEFAULTS, costVariance, expectedCost, frontier, halfLife, holdings, kappa, schedule, simulateShortfall } from '../../lib/exec/almgrenChriss';
import { Button, Segmented, Slider } from '../ui/controls';
import { WidgetFrame } from '../ui/WidgetFrame';
import { niceTicks } from './format';
import { Label, PlotFrame } from './PlotFrame';

const STEPS = 78; // five-minute slices of a 6.5-hour day
const PATHS = 2000;
const LOG_GAMMAS = Array.from({ length: 41 }, (_, i) => -9 + i * 0.1);
type Panel = 'frontier' | 'costs';

const thousands = (v: number) => {
  const a = Math.abs(v), sign = v < 0 ? '−' : '';
  if (a < 500) return '$0';
  if (a >= 1e6 - 1) return `${sign}$${Number((a / 1e6).toFixed(2))}M`;
  return `${sign}$${Math.round(a / 1e3).toLocaleString('en-US')}k`;
};
const sci = (lg: number) => {
  const e = Math.floor(lg + 1e-9), m = 10 ** (lg - e);
  return `${m.toFixed(1)}×10${String(e).replace('-', '⁻').replace(/\d/g, (d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[Number(d)])}`;
};

function histogram(values: number[], lo: number, hi: number, bins: number): number[] {
  const h = new Array(bins).fill(0), w = (hi - lo) / bins; // share of paths per bin
  for (const v of values) {
    const b = Math.floor((v - lo) / w);
    if (b >= 0 && b < bins) h[b]++;
  }
  return h.map((c) => c / values.length);
}

interface AlmgrenChrissProps {
  title?: string;
  initialLogGamma?: number;
  initialPanel?: Panel;
}

/**
 * Chapter 62: the Almgren–Chriss trade-off. Top: holdings over the day for the
 * chosen risk aversion, against TWAP. Bottom: either the efficient frontier of
 * expected cost against its standard deviation, or simulated distributions of
 * the implementation shortfall for the strategy and for TWAP (same random
 * paths for both).
 */
export default function AlmgrenChriss({ title = 'Optimal execution: Almgren–Chriss', initialLogGamma = -7, initialPanel = 'frontier' }: AlmgrenChrissProps) {
  const [lg, setLg] = useState(initialLogGamma);
  const [vol, setVol] = useState(0.02);
  const [panel, setPanel] = useState<Panel>(initialPanel);
  const [seed, setSeed] = useState(62);

  const base = { ...AC_DEFAULTS, sigma: vol * 100 };
  const p = { ...base, gamma: 10 ** lg };
  const twap = { ...base, gamma: 0 };
  const E = expectedCost(p), sd = Math.sqrt(costVariance(p));
  const E0 = expectedCost(twap), sd0 = Math.sqrt(costVariance(twap));
  const kT = kappa(p) * p.T;

  const ts = Array.from({ length: 101 }, (_, i) => i / 100);
  const top = (
    <PlotFrame x={[0, 1]} y={[0, 1.08e6]} height={190} xTicks={[0, 0.25, 0.5, 0.75, 1]} yTicks={[0, 250e3, 500e3, 750e3, 1e6]} formatX={(v) => (v === 1 ? '1 day' : String(v))} formatY={(v) => (v === 0 ? '0' : `${v / 1e6}M`)} xLabel="time" yLabel="shares still to sell" marginLeft={52}>
      <Line.Segment point1={[0, 1e6]} point2={[1, 0]} color="var(--text-muted)" weight={1.5} style="dashed" />
      <Label x={0.62} y={0.38e6} attach="ne" attachDistance={4} size={11} color="var(--text-muted)">TWAP</Label>
      <Polygon points={[[0, 0], ...ts.map((t) => [t, holdings(p, t)] as [number, number]), [1, 0]]} color="var(--c-ask)" fillOpacity={0.15} strokeOpacity={0} />
      <Polyline points={ts.map((t) => [t, holdings(p, t)] as [number, number])} color="var(--c-ask)" weight={3} fillOpacity={0} />
      <Point x={halfLife(p)} y={5e5} color="var(--c-ask)" />
      <Label x={halfLife(p)} y={5e5} attach="ne" attachDistance={6} size={11} color="var(--c-ask)">half sold</Label>
    </PlotFrame>
  );

  const pts = useMemo(() => frontier(base, LOG_GAMMAS.map((g) => 10 ** g)), [vol]);
  const fxMax = Math.max(...pts.map((q) => q.sd)) * 1.1, fyMax = Math.max(...pts.map((q) => q.mean)) * 1.08;
  const frontierPlot = (
    <PlotFrame x={[0, fxMax]} y={[0, fyMax]} height={220} xTicks={niceTicks(0, fxMax, 4)} yTicks={niceTicks(0, fyMax, 4)} formatX={thousands} formatY={thousands} xLabel="standard deviation of the cost" yLabel="expected cost" marginLeft={58}>
      <Polyline points={pts.map((q) => [q.sd, q.mean] as [number, number])} color="var(--text)" weight={2} fillOpacity={0} />
      <Point x={sd0} y={E0} color="var(--text-muted)" />
      <Label x={sd0} y={E0} attach="s" attachDistance={8} size={11} color="var(--text-muted)">TWAP</Label>
      <Point x={sd} y={E} color="var(--c-ask)" />
      <Label x={sd} y={E} attach="nw" attachDistance={6} size={11} color="var(--c-ask)">your strategy</Label>
      <Label x={pts[pts.length - 1].sd} y={pts[pts.length - 1].mean * 0.8} attach="w" attachDistance={8} size={11} color="var(--text-muted)">faster</Label>
    </PlotFrame>
  );

  const sims = useMemo(() => ({
    opt: simulateShortfall(p, schedule(p, STEPS), PATHS, seed),
    twap: simulateShortfall(twap, schedule(twap, STEPS), PATHS, seed),
  }), [lg, vol, seed]);
  const span = 3.2 * sd0;
  const hLo = E0 - span, hHi = E0 + span, BINS = 40, w = (hHi - hLo) / BINS;
  const hOpt = histogram(sims.opt, hLo, hHi, BINS), hTwap = histogram(sims.twap, hLo, hHi, BINS);
  const dMax = Math.max(...hOpt, ...hTwap) * 1.15;
  const step = (h: number[]) => h.flatMap((d, i) => [[hLo + i * w, d], [hLo + (i + 1) * w, d]] as [number, number][]);
  const costsPlot = (
    <PlotFrame x={[hLo, hHi]} y={[0, dMax]} height={220} xTicks={niceTicks(hLo, hHi, 4)} yTicks={[]} formatX={thousands} xLabel="implementation shortfall (cost of selling)" yLabel="frequency" marginLeft={20}>
      <Polygon points={[[hLo, 0], ...step(hOpt), [hHi, 0]]} color="var(--c-ask)" fillOpacity={0.35} strokeOpacity={0} />
      <Polyline points={step(hTwap)} color="var(--text-muted)" weight={1.5} fillOpacity={0} />
      <Line.Segment point1={[E, 0]} point2={[E, dMax * 0.92]} color="var(--c-ask)" weight={2} style="dashed" />
      <Plot.OfX y={() => 0} color="var(--axis)" weight={1} domain={[hLo, hHi]} />
    </PlotFrame>
  );

  const pct = (a: number, b: number) => `${a >= b ? '+' : '−'}${Math.abs((a / b - 1) * 100).toFixed(1)}%`;
  return (
    <WidgetFrame
      title={title}
      ariaLabel={`With risk aversion ${sci(lg)} per dollar, the seller sells half the position by ${(halfLife(p) * 6.5).toFixed(1)} hours; expected cost ${thousands(E)} with standard deviation ${thousands(sd)}, against ${thousands(E0)} and ${thousands(sd0)} for TWAP.`}
      plotHeight={410}
      plot={<>{top}<div style={{ borderTop: '1px solid var(--border)' }}>{panel === 'frontier' ? frontierPlot : costsPlot}</div></>}
      controls={
        <>
          <Slider label="Risk aversion $\gamma$" value={lg} min={-9} max={-5} step={0.1} onChange={setLg} format={sci} color="var(--c-ask)" />
          <Slider label="Daily volatility $\sigma$" value={vol} min={0.01} max={0.04} step={0.0025} onChange={setVol} format={(v) => `${(v * 100).toFixed(2)}%`} color="var(--c-vol)" />
          <Segmented label="Lower panel" value={panel} onChange={setPanel} options={[{ value: 'frontier', label: 'Efficient frontier' }, { value: 'costs', label: 'Simulated costs' }]} />
          <Button onClick={() => setSeed((s) => s + 1)}>Re-simulate</Button>
        </>
      }
      readout={
        <dl className="readout-grid">
          <dt>Urgency κT</dt><dd>{kT.toFixed(2)} <span className="muted">half sold after {(halfLife(p) * 6.5).toFixed(1)} of 6.5 hours</span></dd>
          <dt>Expected cost</dt><dd>{thousands(E)} <span className="muted">({pct(E, E0)} against TWAP)</span></dd>
          <dt>Standard deviation</dt><dd>{thousands(sd)} <span className="muted">({pct(sd, sd0)} against TWAP)</span></dd>
        </dl>
      }
      caption="Selling 1 million shares of a \$100 stock over one trading day, about 10% of its daily volume. Selling at a constant rate costs 30¢ a share in temporary impact, and the whole sale pushes the price down permanently by 10¢. Pink: the optimal strategy for a risk aversion $\gamma$ per dollar. Grey: TWAP, selling at a constant rate. The simulated costs use the same 2,000 random price paths for both."
    />
  );
}
