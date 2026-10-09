import { Line, Point, Polyline } from 'mafs';
import { useMemo, useState } from 'react';
import { discoveryShares, fitVECM, simulateTwoMarkets } from '../../lib/info/priceDiscovery';
import { Button, Slider } from '../ui/controls';
import { WidgetFrame } from '../ui/WidgetFrame';
import { extent, niceTicks } from './format';
import { Label, PlotFrame } from './PlotFrame';

const N = 5000;
const SHOW = 80;
const pct = (v: number) => `${Math.round(v * 100)}%`;

/**
 * Chapter 54: a stock and the stock price implied by its options both chase one
 * efficient price, each at its own speed. From the two price series alone, a
 * VECM estimates how much of the price discovery each market does.
 */
export default function PriceDiscovery({ title = 'Who finds the price first?' }: { title?: string }) {
  const [kStock, setKStock] = useState(0.6);
  const [kOption, setKOption] = useState(0.3);
  const [noise, setNoise] = useState(0.01);
  const [seed, setSeed] = useState(54);
  const sim = useMemo(() => simulateTwoMarkets({ n: N, m0: 100, sigmaM: 0.05, kStock, kOption, noise, seed }), [kStock, kOption, noise, seed]);
  const vecm = useMemo(() => fitVECM(sim.stock, sim.option, 2), [sim]);
  const sh = discoveryShares(vecm);

  const [lo, hi] = extent([...sim.m.slice(0, SHOW + 1), ...sim.stock.slice(0, SHOW + 1), ...sim.option.slice(0, SHOW + 1)]);
  const pad = (hi - lo) * 0.1 + 0.02;
  const yTicks = niceTicks(lo - pad, hi + pad, 4);
  const line = (xs: number[]) => xs.slice(0, SHOW + 1).map((y, t) => [t, y] as [number, number]);
  const top = (
    <PlotFrame x={[0, SHOW]} y={[Math.min(lo - pad, yTicks[0]), Math.max(hi + pad, yTicks[yTicks.length - 1])]} height={220} xTicks={[0, 20, 40, 60, 80]} yTicks={yTicks} formatY={(v) => v.toFixed(2)} xLabel="time (steps)" yLabel="price ($)" marginLeft={50}>
      <Polyline points={line(sim.m)} color="var(--text-muted)" weight={1.5} strokeStyle="dashed" fillOpacity={0} />
      <Polyline points={line(sim.option)} color="var(--text)" weight={1.8} fillOpacity={0} />
      <Polyline points={line(sim.stock)} color="var(--c-spot)" weight={2.2} fillOpacity={0} />
    </PlotFrame>
  );

  const bottom = (
    <div style={{ borderTop: '1px solid var(--border)' }}>
      <PlotFrame x={[0, 1]} y={[0.4, 3.1]} height={150} xTicks={[0, 0.25, 0.5, 0.75, 1]} yTicks={[]} formatX={pct} xLabel="share of price discovery done by the stock" marginLeft={14}>
        <Line.Segment point1={[0.5, 0.35]} point2={[0.5, 3.0]} color="var(--axis)" style="dashed" weight={1} />
        <Label x={0} y={2.8} attach="e" attachDistance={4} size={11} color="var(--text)">Component share (Gonzalo–Granger)</Label>
        <Point x={Math.min(Math.max(sh.componentShare, 0), 1)} y={2.35} color="var(--c-spot)" />
        <Label x={0} y={1.6} attach="e" attachDistance={4} size={11} color="var(--text)">Information share (Hasbrouck), bounds</Label>
        <Line.Segment point1={[sh.infoShareLow, 1.05]} point2={[sh.infoShareHigh, 1.05]} color="var(--c-spot)" weight={6} opacity={0.6} />
        <Point x={sh.infoShareLow} y={1.05} color="var(--c-spot)" />
        <Point x={sh.infoShareHigh} y={1.05} color="var(--c-spot)" />
      </PlotFrame>
    </div>
  );

  return (
    <WidgetFrame
      title={title}
      ariaLabel={`The stock's component share of price discovery is ${pct(sh.componentShare)}; its information share lies between ${pct(sh.infoShareLow)} and ${pct(sh.infoShareHigh)}.`}
      plotHeight={370}
      plot={<>{top}{bottom}</>}
      controls={
        <>
          <Slider label="Stock's speed of adjustment $\kappa_S$" value={kStock} min={0.05} max={1} step={0.05} onChange={setKStock} format={(v) => v.toFixed(2)} color="var(--c-spot)" />
          <Slider label="Options' speed of adjustment $\kappa_O$" value={kOption} min={0.05} max={1} step={0.05} onChange={setKOption} format={(v) => v.toFixed(2)} />
          <Slider label="Noise in each market" value={noise} min={0} max={0.05} step={0.005} onChange={setNoise} format={(v) => `${Math.round(v * 100)}¢`} />
          <Button onClick={() => setSeed((s) => s + 1)}>Re-simulate</Button>
        </>
      }
      readout={
        <dl className="readout-grid">
          <dt>Error correction</dt><dd>α_stock = {vecm.alpha[0].toFixed(3).replace('-', '−')}, α_options = {vecm.alpha[1].toFixed(3).replace('-', '−')} <span className="muted">(how hard each closes the gap)</span></dd>
          <dt>Component share</dt><dd>stock {pct(sh.componentShare)}, options {pct(1 - sh.componentShare)}</dd>
          <dt>Information share</dt><dd>stock between {pct(sh.infoShareLow)} and {pct(sh.infoShareHigh)}</dd>
        </dl>
      }
      caption={`Top: the first ${SHOW} of ${N.toLocaleString('en-US')} steps. Dashed grey is the efficient price, blue the stock, solid grey (black in the light theme) the stock price implied by the options through put–call parity. Bottom: shares estimated from the two price series alone.`}
    />
  );
}
