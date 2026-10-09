import { Polyline } from 'mafs';
import { useMemo, useState } from 'react';
import { DAY_HOURS, zeroDteCall } from '../../lib/feedback/intraday';
import { Slider } from '../ui/controls';
import { WidgetFrame } from '../ui/WidgetFrame';
import { niceTicks } from './format';
import { PlotFrame } from './PlotFrame';

const SIGMA = 0.2;
const K = 100;
const US = Array.from({ length: 381 }, (_, i) => i / 390); // to 15:50: the last minutes' spike would flatten everything else
const HOUR_TICKS = [0, 1.5, 3.5, 5.5, 6.5];
const clock = (h: number) => {
  const m = 9 * 60 + 30 + Math.round(h * 60);
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
};
const ROWS = [
  { label: '9:30', h: 0 },
  { label: '12:00', h: 2.5 },
  { label: '15:00', h: 5.5 },
  { label: '15:55', h: 6.4167 },
];

interface IntradayGammaProps {
  title?: string;
  initialMoneyness?: number;
}

/**
 * Chapter 68: an option in its final day. Value, gamma and theta per hour of a
 * call expiring at today's close, if the stock stays put, with volatility
 * spread evenly over the day (dashed) or arriving in a U shape (solid).
 */
export default function IntradayGamma({ title = 'The last day of an option', initialMoneyness = 0 }: IntradayGammaProps) {
  const [m, setM] = useState(initialMoneyness); // stock above the strike, %
  const S = K * (1 + m / 100);
  const curves = useMemo(() => [true, false].map((seasonal) => US.map((u) => ({ h: u * DAY_HOURS, ...zeroDteCall(S, K, SIGMA, u, seasonal) }))), [S]);
  const [u, f] = curves;

  const panel = (key: 'value' | 'gamma' | 'thetaPerHour', cap: number, label: string, fmt: (v: number) => string, height: number, xLabel?: string) => {
    const top = Math.min(cap, Math.max(...u.map((p) => p[key]), ...f.map((p) => p[key]))) * 1.3 || 1;
    const pts = (c: typeof u) => c.map((p) => [p.h, Math.min(p[key], top)] as [number, number]);
    return (
      <PlotFrame x={[0, DAY_HOURS]} y={[0, top]} height={height} xTicks={HOUR_TICKS} yTicks={niceTicks(0, top, 3)} formatX={clock} formatY={fmt} xLabel={xLabel} yLabel={label} marginLeft={48}>
        <Polyline points={pts(f)} color="var(--c-call)" weight={1.5} strokeStyle="dashed" fillOpacity={0} />
        <Polyline points={pts(u)} color="var(--c-call)" weight={2.5} fillOpacity={0} />
      </PlotFrame>
    );
  };

  const plot = (
    <>
      {panel('value', Infinity, 'call value', (v) => `$${v.toFixed(2)}`, 140)}
      <div style={{ borderTop: '1px solid var(--border)' }}>{panel('gamma', 4, 'gamma (per $1)', (v) => v.toFixed(1), 130)}</div>
      <div style={{ borderTop: '1px solid var(--border)' }}>{panel('thetaPerHour', 1, 'theta per hour', (v) => `${(v * 100).toFixed(0)}¢`, 150, 'time of day')}</div>
    </>
  );

  return (
    <WidgetFrame
      title={title}
      ariaLabel={`A call expiring today with the stock ${m.toFixed(2)}% from the $100 strike: worth $${u[0].value.toFixed(2)} at the open, gamma ${u[0].gamma.toFixed(2)} rising to ${u[U_LAST].gamma.toFixed(2)} near the close.`}
      plotHeight={420}
      plot={plot}
      controls={<Slider label="Stock above the strike" value={m} min={-1.5} max={1.5} step={0.05} onChange={setM} format={(v) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(2)}%`} />}
      readout={
        <table className="iter-table">
          <thead><tr><th>Time</th><th>Value</th><th>Gamma</th><th>Theta / hour</th></tr></thead>
          <tbody>
            {ROWS.map((r) => {
              const p = zeroDteCall(S, K, SIGMA, r.h / DAY_HOURS, true);
              return <tr key={r.label}><td>{r.label}</td><td>${p.value.toFixed(3)}</td><td>{p.gamma.toFixed(2)}</td><td>{(p.thetaPerHour * 100).toFixed(1)}¢</td></tr>;
            })}
          </tbody>
        </table>
      }
      caption="A call on a \$100 stock with 20% volatility, struck at \$100 and expiring at today's 16:00 close, if the stock stays where it is. Solid: volatility arrives in a U shape, heavy at the open and into the close. Dashed: volatility spread evenly over the day. The curves stop at 15:50, before the last minutes' extremes; the readout uses the U-shaped day."
    />
  );
}

const U_LAST = US.length - 1;
