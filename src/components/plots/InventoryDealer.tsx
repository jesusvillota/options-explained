import { Polygon, Polyline } from 'mafs';
import { useMemo, useState } from 'react';
import { dealerStats, simulateDealer, type DealerParams } from '../../lib/info/inventory';
import { Button, Slider } from '../ui/controls';
import { WidgetFrame } from '../ui/WidgetFrame';
import { extent, money, niceTicks } from './format';
import { Label, PlotFrame } from './PlotFrame';

const MULTIPLIER = 100;
const DAYS = 300;
const BASE: Omit<DealerParams, 'shade' | 'h' | 'seed'> = { steps: 390, dt: 1, v0: 2.48, sigma: 0.475 / Math.sqrt(390), A: 0.5, k: 20 };

interface InventoryDealerProps {
  title?: string;
  initialShade?: number;
}

/**
 * Chapter 49: a dealer quoting the $105 call through one trading day, with and
 * without shading its quotes against its inventory. Top: one day's inventory.
 * Bottom: the distribution of daily P&L over 300 simulated days.
 */
export default function InventoryDealer({ title = 'Carrying inventory', initialShade = 0.005 }: InventoryDealerProps) {
  const [shade, setShade] = useState(initialShade);
  const [h, setH] = useState(0.075);
  const [seed, setSeed] = useState(49);
  const day = useMemo(() => ({
    off: simulateDealer({ ...BASE, h, shade: 0, seed }),
    on: simulateDealer({ ...BASE, h, shade, seed }),
  }), [h, shade, seed]);
  const stats = useMemo(() => ({
    off: dealerStats({ ...BASE, h, shade: 0 }, DAYS, seed * 31),
    on: dealerStats({ ...BASE, h, shade }, DAYS, seed * 31),
  }), [h, shade, seed]);

  const [iLo, iHi] = extent([...day.off.inventory, ...day.on.inventory]);
  const iSpan = Math.max(Math.abs(iLo), Math.abs(iHi), 5) * 1.15;
  const top = (
    <PlotFrame x={[0, 390]} y={[-iSpan, iSpan]} height={190} xTicks={[0, 60, 120, 180, 240, 300, 360]} yTicks={niceTicks(-iSpan, iSpan, 4)} formatX={(t) => `${Math.floor(t / 60) + 9}:${t % 60 === 0 ? '30' : '00'}`} formatY={(v) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v)}`} baseline={0} xLabel="time of day" yLabel="inventory (contracts)" marginLeft={40}>
      <Polyline points={day.off.inventory.map((q, t) => [t, q] as [number, number])} color="var(--text-muted)" weight={1.5} strokeStyle="dashed" fillOpacity={0} />
      <Polyline points={day.on.inventory.map((q, t) => [t, q] as [number, number])} color="var(--text)" weight={2.2} fillOpacity={0} />
    </PlotFrame>
  );

  // Range from the 1st to the 99th percentile; the few outliers go in the end bins.
  const all = [...stats.off.pnls, ...stats.on.pnls].map((x) => x * MULTIPLIER).sort((a, b) => a - b);
  const lo = all[Math.floor(0.01 * all.length)], hi = all[Math.floor(0.99 * all.length)];
  const bins = 30, w = (hi - lo) / bins || 1;
  const hist = (xs: number[]) => {
    const out = new Array<number>(bins).fill(0);
    for (const x of xs) out[Math.min(Math.max(Math.floor((x * MULTIPLIER - lo) / w), 0), bins - 1)]++;
    return out;
  };
  const hOff = hist(stats.off.pnls), hOn = hist(stats.on.pnls);
  const hMax = Math.max(...hOff, ...hOn);
  const bars = (hs: number[], color: string, fill: number, dashed: boolean) => hs.map((c, b) => c > 0 && (
    <Polygon key={`${color}${b}`} points={[[lo + b * w, 0], [lo + (b + 1) * w, 0], [lo + (b + 1) * w, c], [lo + b * w, c]]} color={color} fillOpacity={fill} strokeOpacity={0.8} weight={1} strokeStyle={dashed ? 'dashed' : 'solid'} />
  ));
  const bottom = (
    <div style={{ borderTop: '1px solid var(--border)' }}>
      <PlotFrame x={[lo - w, hi + w]} y={[0, hMax * 1.2]} height={170} xTicks={niceTicks(lo, hi, 5)} yTicks={[]} formatX={(v) => `${v < 0 ? '−' : ''}$${Math.abs(v)}`} xLabel={`P&L per day, ${DAYS} simulated days`}>
        {bars(hOff, 'var(--text-muted)', 0.12, true)}
        {bars(hOn, 'var(--text)', 0.45, false)}
        <Label x={lo} y={hMax * 1.12} attach="e" size={11} color="var(--text-muted)">dashed: no shading</Label>
        <Label x={hi} y={hMax * 1.12} attach="w" size={11} color="var(--text)">solid: shading</Label>
      </PlotFrame>
    </div>
  );

  const row = (name: string, s: typeof stats.on) => (
    <tr>
      <td style={{ textAlign: 'left' }}>{name}</td>
      <td>{money(s.meanPnl * MULTIPLIER, 0)}</td>
      <td>{money(s.sdPnl * MULTIPLIER, 0)}</td>
      <td>{s.rmsInventory.toFixed(1)}</td>
    </tr>
  );

  return (
    <WidgetFrame
      title={title}
      ariaLabel={`Without shading the daily P&L has a standard deviation of ${money(stats.off.sdPnl * MULTIPLIER, 0)}; shading ${(shade * 100).toFixed(1)} cents per contract cuts it to ${money(stats.on.sdPnl * MULTIPLIER, 0)}.`}
      plotHeight={360}
      plot={<>{top}{bottom}</>}
      controls={
        <>
          <Slider label="Shade quotes per contract held" value={shade} min={0} max={0.03} step={0.001} onChange={setShade} format={(v) => `${(v * 100).toFixed(1)}¢`} />
          <Slider label="Half-spread $h$" value={h} min={0.01} max={0.15} step={0.005} onChange={setH} format={(v) => `${(v * 100).toFixed(1)}¢`} />
          <Button onClick={() => setSeed((s) => s + 1)}>Re-simulate</Button>
        </>
      }
      readout={
        <>
        <table className="iter-table">
          <thead><tr><th style={{ textAlign: 'left' }}>Per day</th><th>Mean P&L</th><th>Std dev</th><th>Inventory</th></tr></thead>
          <tbody>
            {row('No shade', stats.off)}
            {row(`Shade ${(shade * 100).toFixed(1)}¢`, stats.on)}
          </tbody>
        </table>
        <p className="muted">Trades per day: {stats.off.meanTrades.toFixed(0)} without shading, {stats.on.meanTrades.toFixed(0)} with.</p>
        </>
      }
      caption="A dealer quotes the three-month \$105 call (worth about \$2.48, moving about 47¢ a day) for one 390-minute trading day. Customers hit a quote more often the closer it is to fair value. Inventory in the table is the root-mean-square position at the close. Shading moves both quotes down by the given amount for every contract the dealer is long (up, if short). P&L is per day, in dollars; inventory at the close is marked at fair value."
    />
  );
}
