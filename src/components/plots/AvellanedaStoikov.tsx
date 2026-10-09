import { Polygon, Polyline } from 'mafs';
import { useMemo, useState } from 'react';
import { asStats, optimalSpread, simulateAS, type ASParams } from '../../lib/mm/avellanedaStoikov';
import { Button, Slider } from '../ui/controls';
import { WidgetFrame } from '../ui/WidgetFrame';
import { extent, niceTicks } from './format';
import { Label, PlotFrame } from './PlotFrame';

const RUNS = 400;
const BASE = { A: 140, T: 1, dt: 0.005, s0: 100 };

/**
 * Chapter 57: the Avellaneda–Stoikov market maker against a symmetric one with
 * the same spread. Top: one run's mid, reservation price and quotes. Middle:
 * inventory for both strategies on the same market. Bottom: final P&L over
 * many runs.
 */
export default function AvellanedaStoikov({ title = 'Avellaneda–Stoikov in action' }: { title?: string }) {
  const [logGamma, setLogGamma] = useState(-1);
  const [sigma, setSigma] = useState(2);
  const [k, setK] = useState(1.5);
  const [seed, setSeed] = useState(57);
  const gamma = 10 ** logGamma;
  const p: ASParams = { gamma, sigma, k, A: BASE.A, T: BASE.T };
  const inv = useMemo(() => simulateAS({ ...p, ...BASE, seed, strategy: 'inventory' }), [gamma, sigma, k, seed]);
  const sym = useMemo(() => simulateAS({ ...p, ...BASE, seed, strategy: 'symmetric' }), [gamma, sigma, k, seed]);
  const stats = useMemo(() => ({
    inv: asStats({ ...p, ...BASE, strategy: 'inventory' }, RUNS, seed * 7),
    sym: asStats({ ...p, ...BASE, strategy: 'symmetric' }, RUNS, seed * 7),
  }), [gamma, sigma, k, seed]);

  const n = inv.bid.length;
  const [lo, hi] = extent([...inv.S, ...inv.bid, ...inv.ask, ...inv.r]);
  const yT = niceTicks(lo, hi, 4);
  const top = (
    <PlotFrame x={[0, 1]} y={[Math.min(lo, yT[0]), Math.max(hi, yT[yT.length - 1])]} height={190} xTicks={[0, 0.25, 0.5, 0.75, 1]} yTicks={yT} formatX={(v) => `${v}`} formatY={(v) => v.toFixed(0)} yLabel="price" marginLeft={40}>
      <Polyline points={inv.ask.map((a, i) => [inv.t[i], a] as [number, number])} color="var(--c-ask)" weight={1} fillOpacity={0} />
      <Polyline points={inv.bid.map((b, i) => [inv.t[i], b] as [number, number])} color="var(--c-bid)" weight={1} fillOpacity={0} />
      <Polyline points={inv.r.slice(0, n).map((r, i) => [inv.t[i], r] as [number, number])} color="var(--c-strike)" weight={1.5} strokeStyle="dashed" fillOpacity={0} />
      <Polyline points={inv.S.map((s, i) => [inv.t[i], s] as [number, number])} color="var(--c-spot)" weight={2} fillOpacity={0} />
    </PlotFrame>
  );

  const [qLo, qHi] = extent([...inv.q, ...sym.q]);
  const qSpan = Math.max(Math.abs(qLo), Math.abs(qHi), 4) * 1.15;
  const middle = (
    <div style={{ borderTop: '1px solid var(--border)' }}>
      <PlotFrame x={[0, 1]} y={[-qSpan, qSpan]} height={120} xTicks={[0, 0.25, 0.5, 0.75, 1]} yTicks={niceTicks(-qSpan, qSpan, 4)} formatX={(v) => `${v}`} formatY={(v) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v)}`} baseline={0} xLabel="time t / T" yLabel="inventory q" marginLeft={40}>
        <Polyline points={sym.q.map((q, i) => [sym.t[i], q] as [number, number])} color="var(--text-muted)" weight={1.5} strokeStyle="dashed" fillOpacity={0} />
        <Polyline points={inv.q.map((q, i) => [inv.t[i], q] as [number, number])} color="var(--text)" weight={2} fillOpacity={0} />
      </PlotFrame>
    </div>
  );

  const all = [...stats.inv.pnls, ...stats.sym.pnls].sort((a, b) => a - b);
  const pLo = all[Math.floor(0.01 * all.length)], pHi = all[Math.floor(0.99 * all.length)];
  const bins = 28, w = (pHi - pLo) / bins || 1;
  const hist = (xs: number[]) => { const h = new Array<number>(bins).fill(0); for (const x of xs) h[Math.min(Math.max(Math.floor((x - pLo) / w), 0), bins - 1)]++; return h; };
  const hInv = hist(stats.inv.pnls), hSym = hist(stats.sym.pnls), hMax = Math.max(...hInv, ...hSym);
  const bars = (h: number[], color: string, fill: number, dashed: boolean) => h.map((c, b) => c > 0 && (
    <Polygon key={`${color}${b}`} points={[[pLo + b * w, 0], [pLo + (b + 1) * w, 0], [pLo + (b + 1) * w, c], [pLo + b * w, c]]} color={color} fillOpacity={fill} strokeOpacity={0.8} weight={1} strokeStyle={dashed ? 'dashed' : 'solid'} />
  ));
  const bottom = (
    <div style={{ borderTop: '1px solid var(--border)' }}>
      <PlotFrame x={[pLo - w, pHi + w]} y={[0, hMax * 1.25]} height={140} xTicks={niceTicks(pLo, pHi, 5)} yTicks={[]} formatX={(v) => v.toFixed(0)} xLabel={`final P&L, ${RUNS} runs`}>
        {bars(hSym, 'var(--text-muted)', 0.12, true)}
        {bars(hInv, 'var(--text)', 0.45, false)}
        <Label x={pLo} y={hMax * 1.18} attach="e" size={11} color="var(--text-muted)">dashed: symmetric</Label>
        <Label x={pHi} y={hMax * 1.18} attach="w" size={11} color="var(--text)">solid: inventory-aware</Label>
      </PlotFrame>
    </div>
  );

  const row = (name: string, s: typeof stats.inv) => (
    <tr><td style={{ textAlign: 'left' }}>{name}</td><td>{s.meanPnl.toFixed(1)}</td><td>{s.sdPnl.toFixed(1)}</td><td>{s.sdInventory.toFixed(1)}</td></tr>
  );

  return (
    <WidgetFrame
      title={title}
      ariaLabel={`With risk aversion ${gamma.toFixed(2)}, the inventory-aware strategy earns ${stats.inv.meanPnl.toFixed(1)} with standard deviation ${stats.inv.sdPnl.toFixed(1)}, against ${stats.sym.meanPnl.toFixed(1)} and ${stats.sym.sdPnl.toFixed(1)} for the symmetric one.`}
      plotHeight={450}
      plot={<>{top}{middle}{bottom}</>}
      controls={
        <>
          <Slider label="Risk aversion $\gamma$" value={logGamma} min={-2} max={0} step={0.05} onChange={setLogGamma} format={(v) => (10 ** v).toFixed(v < -1.5 ? 3 : 2)} color="var(--c-put)" />
          <Slider label="Volatility $\sigma$" value={sigma} min={1} max={4} step={0.25} onChange={setSigma} format={(v) => v.toFixed(2)} color="var(--c-vol)" />
          <Slider label="Order-flow decay $k$" value={k} min={0.5} max={3} step={0.1} onChange={setK} format={(v) => v.toFixed(1)} />
          <Button onClick={() => setSeed((s) => s + 1)}>Re-simulate</Button>
        </>
      }
      readout={
        <>
          <table className="iter-table">
            <thead><tr><th style={{ textAlign: 'left' }}>Strategy</th><th>Mean P&L</th><th>Std dev</th><th>Inventory</th></tr></thead>
            <tbody>{row('Inventory-aware', stats.inv)}{row('Symmetric', stats.sym)}</tbody>
          </table>
          <p className="muted">Total spread {optimalSpread(0, p).toFixed(2)} at the start, {optimalSpread(1, p).toFixed(2)} at the end. Inventory is the root-mean-square position at the end.</p>
        </>
      }
      caption="The setting of Avellaneda and Stoikov's paper: S₀ = 100, σ = 2, A = 140, k = 1.5, T = 1, steps of 0.005. Top: mid (blue), reservation price (dashed yellow), and the inventory-aware ask and bid. Middle: inventory with the inventory-aware quotes (solid) and with symmetric quotes of the same width (dashed), on the same market. Bottom: final P&L."
    />
  );
}
