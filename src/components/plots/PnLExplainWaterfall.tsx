import { Line, Polygon } from 'mafs';
import { useState } from 'react';
import { greeks } from '../../lib/pricing/blackScholes';
import { explainPnL, type Position } from '../../lib/theory/pnlExplain';
import { Slider } from '../ui/controls';
import { WidgetFrame } from '../ui/WidgetFrame';
import { useMediaQuery } from './animation';
import { signedMoney } from './format';
import { Label, PlotFrame } from './PlotFrame';

/** A small, realistic book: long at-the-money calls, short downside puts, long upside calls. */
const BOOK: Position[] = [
  { type: 'call', K: 100, T: 0.25, quantity: 1000 },
  { type: 'put', K: 90, T: 0.1, quantity: -2000 },
  { type: 'call', K: 110, T: 0.5, quantity: 500 },
];
const BEFORE = { S: 100, sigma: 0.2, r: 0.03 };
const STEPS = ['delta', 'gamma', 'vega', 'theta', 'vanna', 'unexplained'] as const;
const LABEL: Record<(typeof STEPS)[number], string> = { delta: 'Δ', gamma: 'Γ', vega: 'vega', theta: 'Θ', vanna: 'vanna', unexplained: 'rest' };

/**
 * Chapter 42: explain a day's P&L for an options book. Choose the stock move,
 * the volatility move and the days passed; the waterfall splits the P&L into
 * Greek contributions plus whatever the Taylor expansion misses.
 */
export default function PnLExplainWaterfall() {
  const [move, setMove] = useState(0.02);
  const [dVol, setDVol] = useState(0.01);
  const [days, setDays] = useState(1);
  const narrow = useMediaQuery('(max-width: 480px)');
  const after = { S: BEFORE.S * (1 + move), sigma: BEFORE.sigma + dVol, r: BEFORE.r };
  const res = explainPnL(BOOK, BEFORE, after, days / 365);
  // Waterfall: each bar starts where the previous one ended.
  let level = 0;
  const bars = STEPS.map((k) => { const from = level; level += res[k]; return { k, from, to: level }; });
  const all = [0, ...bars.flatMap((b) => [b.from, b.to]), res.actual];
  const yLo = Math.min(...all), yHi = Math.max(...all);
  const pad = Math.max((yHi - yLo) * 0.15, 50);
  const bookGreeks = BOOK.reduce((acc, p) => {
    const g = greeks(p.type, { S: BEFORE.S, K: p.K, T: p.T, r: BEFORE.r, sigma: BEFORE.sigma });
    return { delta: acc.delta + p.quantity * g.delta, gamma: acc.gamma + p.quantity * g.gamma, vega: acc.vega + p.quantity * g.vega * 0.01 };
  }, { delta: 0, gamma: 0, vega: 0 });

  return (
    <WidgetFrame
      title="Explaining a day's P&L"
      ariaLabel={`Stock ${move >= 0 ? 'up' : 'down'} ${Math.abs(move * 100).toFixed(1)}%, volatility ${dVol >= 0 ? 'up' : 'down'} ${Math.abs(dVol * 100).toFixed(1)} points, ${days} day(s): actual P&L ${signedMoney(res.actual, 0)}, of which delta ${signedMoney(res.delta, 0)}, gamma ${signedMoney(res.gamma, 0)}, vega ${signedMoney(res.vega, 0)}, theta ${signedMoney(res.theta, 0)}, unexplained ${signedMoney(res.unexplained, 0)}.`}
      plotHeight={280}
      plot={
        <PlotFrame x={[-0.5, STEPS.length + 0.5]} y={[yLo - pad, yHi + pad]} height={280} xTicks={[]} yTicks={[]} baseline={0} yLabel="P&L (dollars)">
          {bars.map(({ k, from, to }, i) => (
            <Polygon key={k} points={[[i + 0.15, from], [i + 0.85, from], [i + 0.85, to], [i + 0.15, to]]} color={to >= from ? 'var(--c-call)' : 'var(--c-put)'} fillOpacity={0.6} strokeOpacity={0.9} weight={1} />
          ))}
          {bars.slice(0, -1).map(({ k, to }, i) => <Line.Segment key={`c${k}`} point1={[i + 0.85, to]} point2={[i + 1.15, to]} color="var(--text-muted)" weight={1} style="dashed" />)}
          <Polygon points={[[STEPS.length + 0.15, 0], [STEPS.length + 0.85, 0], [STEPS.length + 0.85, res.actual], [STEPS.length + 0.15, res.actual]]} color="var(--c-strike)" fillOpacity={0.6} strokeOpacity={0.9} weight={1} />
          {bars.map(({ k, from, to }, i) => (
            <Label key={`l${k}`} x={i + 0.5} y={Math.min(from, to)} attach="s" attachDistance={6} size={12} color="var(--text)">{LABEL[k]}</Label>
          ))}
          {!narrow && bars.map(({ k, from, to }, i) => (
            <Label key={`v${k}`} x={i + 0.5} y={Math.max(from, to)} attach="n" attachDistance={4} size={11} color="var(--text-muted)">{signedMoney(to - from, 0)}</Label>
          ))}
          <Label x={STEPS.length + 0.5} y={Math.min(0, res.actual)} attach="s" attachDistance={6} size={12} color="var(--c-strike)">actual</Label>
        </PlotFrame>
      }
      controls={
        <>
          <Slider label="Stock move" value={move} min={-0.1} max={0.1} step={0.005} onChange={setMove} format={(v) => `${v >= 0 ? '+' : '−'}${Math.abs(v * 100).toFixed(1)}%`} color="var(--c-spot)" />
          <Slider label="Volatility move" value={dVol} min={-0.05} max={0.05} step={0.005} onChange={setDVol} format={(v) => `${v >= 0 ? '+' : '−'}${Math.abs(v * 100).toFixed(1)} pts`} color="var(--c-vol)" />
          <Slider label="Days passed" value={days} min={1} max={10} step={1} onChange={setDays} format={(v) => `${v} day${v === 1 ? '' : 's'}`} color="var(--c-time)" />
        </>
      }
      readout={
        <dl className="readout-grid">
          <dt>Book Greeks</dt><dd>Δ {bookGreeks.delta.toFixed(0)} shares, Γ {bookGreeks.gamma.toFixed(1)} per $, vega {signedMoney(bookGreeks.vega, 0)} per vol point</dd>
          <dt>Actual P&L (full revaluation)</dt><dd className={res.actual >= 0 ? 'good' : 'bad'}>{signedMoney(res.actual, 0)}</dd>
          <dt>Unexplained</dt><dd>{signedMoney(res.unexplained, 0)} <span className="muted">({res.actual !== 0 ? Math.abs((100 * res.unexplained) / res.actual).toFixed(1) : '0'}% of the total)</span></dd>
        </dl>
      }
      caption="Book: long 1,000 calls (K = \$100, 3 months), short 2,000 puts (K = \$90, 5 weeks), long 500 calls (K = \$110, 6 months); stock \$100, volatility 20%. Bars are each Greek's Taylor term; the last bar is the full revaluation."
    />
  );
}
