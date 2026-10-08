import { Polyline } from 'mafs';
import { useMemo, useState } from 'react';
import { BUCKETS, simulateVegaBook, vegaBookStats } from '../../lib/mm/optionBook';
import { Button, Slider } from '../ui/controls';
import { WidgetFrame } from '../ui/WidgetFrame';
import { extent, money, niceTicks } from './format';
import { Label, PlotFrame } from './PlotFrame';

const TRADES = 300;
const DAYS = 150;
const STYLE = [
  { color: 'var(--c-time)', dashed: false },
  { color: 'var(--text)', dashed: true },
  { color: 'var(--text-muted)', dashed: false },
];
const signed = (v: number, digits = 0) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: digits })}`;

/**
 * Chapter 58: an options market maker's vega inventory in three expiry
 * buckets through a day of customer trades. With shading, each bucket's quotes
 * move by −γ(ΩV)_j vol points, so a long position in one expiry also cheapens
 * correlated expiries.
 */
export default function VegaBook({ title = 'A book of vega' }: { title?: string }) {
  const [g, setG] = useState(3);
  const [rho, setRho] = useState(0.8);
  const [seed, setSeed] = useState(58);
  const gamma = g * 1e-5;
  const base = { trades: TRADES, size: 10, edge: 0.5, k: 2, rho };
  const day = useMemo(() => simulateVegaBook({ ...base, gamma, seed }), [gamma, rho, seed]);
  const free = useMemo(() => simulateVegaBook({ ...base, gamma: 0, seed }), [rho, seed]);
  const stats = useMemo(() => ({ on: vegaBookStats({ ...base, gamma }, DAYS, seed * 3), off: vegaBookStats({ ...base, gamma: 0 }, DAYS, seed * 3) }), [gamma, rho, seed]);

  const [lo, hi] = extent([...day.vega.flat(), ...free.vega.flat()]);
  const span = Math.max(Math.abs(lo), Math.abs(hi), 1000) * 1.15;
  const top = (
    <PlotFrame x={[0, TRADES]} y={[-span, span]} height={200} xTicks={[0, 50, 100, 150, 200, 250, 300]} yTicks={niceTicks(-span, span, 4)} formatY={(v) => signed(v)} baseline={0} xLabel="customer trades through the day" yLabel="book vega ($ per vol point)" marginLeft={58}>
      {BUCKETS.map((b, j) => (
        <Polyline key={b.label} points={day.vega.map((v, i) => [i, v[j]] as [number, number])} color={STYLE[j].color} weight={2} strokeStyle={STYLE[j].dashed ? 'dashed' : 'solid'} fillOpacity={0} />
      ))}
      {BUCKETS.map((b, j) => (
        <Label key={`l${j}`} x={TRADES} y={day.vega[TRADES][j]} attach="w" attachDistance={4} size={11} color={STYLE[j].color}>{b.label}</Label>
      ))}
    </PlotFrame>
  );

  const shifts = day.shift.flat();
  const [sLo, sHi] = extent(shifts);
  const sSpan = Math.max(Math.abs(sLo), Math.abs(sHi), 0.1) * 1.2;
  const bottom = (
    <div style={{ borderTop: '1px solid var(--border)' }}>
      <PlotFrame x={[0, TRADES]} y={[-sSpan, sSpan]} height={140} xTicks={[0, 100, 200, 300]} yTicks={niceTicks(-sSpan, sSpan, 4)} formatY={(v) => signed(v, 2)} baseline={0} yLabel="quote shift (vol points)" marginLeft={58}>
        {BUCKETS.map((b, j) => (
          <Polyline key={b.label} points={day.shift.map((s, i) => [i, s[j]] as [number, number])} color={STYLE[j].color} weight={1.6} strokeStyle={STYLE[j].dashed ? 'dashed' : 'solid'} fillOpacity={0} />
        ))}
      </PlotFrame>
    </div>
  );

  const end = day.vega[TRADES];
  return (
    <WidgetFrame
      title={title}
      ariaLabel={`End-of-day vega by expiry: ${end.map((v, j) => `${BUCKETS[j].label} ${signed(v)}`).join(', ')}. Daily volatility risk ${money(day.risk, 0)}.`}
      plotHeight={340}
      plot={<>{top}{bottom}</>}
      controls={
        <>
          <Slider label="Risk aversion $\gamma$ (×10⁻⁵)" value={g} min={0} max={30} step={1} onChange={setG} format={(v) => (v === 0 ? 'off' : String(v))} color="var(--c-put)" />
          <Slider label="Correlation of neighbouring expiries $\rho$" value={rho} min={0} max={0.95} step={0.05} onChange={setRho} format={(v) => v.toFixed(2)} color="var(--c-vol)" />
          <Button onClick={() => setSeed((s) => s + 1)}>New day</Button>
        </>
      }
      readout={
        <>
          <table className="iter-table">
            <thead><tr><th style={{ textAlign: 'left' }}>{DAYS} days</th><th>Edge earned</th><th>Vol risk</th></tr></thead>
            <tbody>
              <tr><td style={{ textAlign: 'left' }}>No shading</td><td>{money(stats.off.meanEdge, 0)}</td><td>{money(stats.off.rmsRisk, 0)}</td></tr>
              <tr><td style={{ textAlign: 'left' }}>Shading</td><td>{money(stats.on.meanEdge, 0)}</td><td>{money(stats.on.rmsRisk, 0)}</td></tr>
            </tbody>
          </table>
          <p className="muted">Vol risk is the standard deviation of the end-of-day book's P&L over the next day, √(VᵀΩV); edge is per day. This day ends with {money(day.risk, 0)} of vol risk (without shading, {money(free.risk, 0)}).</p>
        </>
      }
      caption="Teal: one month; dashed: three months; grey: one year. Three hundred customer trades of 10 contracts in at-the-money options at three expiries, chosen at random, all delta-hedged. Quotes are half a vol point either side of fair value, shifted by the shading. Short expiries' volatilities move more (1.5 points a day, against 1.0 and 0.7) and neighbouring expiries move together with correlation ρ."
    />
  );
}
