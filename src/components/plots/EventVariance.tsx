import { Line, Point, Polyline } from 'mafs';
import { useState } from 'react';
import { eventVariance, impliedMove, ivWithEvent } from '../../lib/feedback/intraday';
import { Slider } from '../ui/controls';
import { WidgetFrame } from '../ui/WidgetFrame';
import { niceTicks } from './format';
import { Label, PlotFrame } from './PlotFrame';

const T1 = 3, T2 = 8, T_EVENT = 3.5, T_MAX = 15; // trading days
const Y = 252;
const DAYS = Array.from({ length: 291 }, (_, i) => 0.5 + i * 0.05);

interface EventVarianceProps {
  title?: string;
}

/**
 * Chapter 68: reading an earnings move off the term structure. An expiry
 * before the announcement and one after it; the extra total variance of the
 * later one, beyond normal days, is the event's variance.
 */
export default function EventVariance({ title = 'The variance of one day' }: EventVarianceProps) {
  const [iv1, setIv1] = useState(0.25);
  const [iv2, setIv2] = useState(0.4);
  const [base, setBase] = useState(0.25);
  const v = Math.max(eventVariance(iv1, T1 / Y, iv2, T2 / Y, base), 0);
  const move = impliedMove(v);

  const w = (d: number) => base * base * (d / Y) + (d > T_EVENT ? v : 0);
  const wMax = Math.max(w(T_MAX), iv2 * iv2 * (T2 / Y), iv1 * iv1 * (T1 / Y)) * 10000 * 1.15;
  const top = (
    <PlotFrame x={[0, T_MAX]} y={[0, wMax]} height={170} xTicks={[0, 3, 5, 8, 10, 15]} yTicks={niceTicks(0, wMax, 3)} formatX={(d) => `${d}d`} formatY={(x) => x.toFixed(0)} yLabel="total variance σ²T (×10⁻⁴)" marginLeft={40}>
      <Polyline points={DAYS.filter((d) => d <= T_EVENT).map((d) => [d, w(d) * 10000] as [number, number])} color="var(--c-vol)" weight={2.5} fillOpacity={0} />
      <Polyline points={DAYS.filter((d) => d > T_EVENT).map((d) => [d, w(d) * 10000] as [number, number])} color="var(--c-vol)" weight={2.5} fillOpacity={0} />
      <Line.Segment point1={[T_EVENT, w(T_EVENT) * 10000]} point2={[T_EVENT, (w(T_EVENT) + v) * 10000]} color="var(--c-ask)" weight={3} />
      <Label x={T_EVENT} y={(w(T_EVENT) + v / 2) * 10000} attach="e" attachDistance={6} size={11} color="var(--c-ask)">earnings</Label>
      <Point x={T1} y={iv1 * iv1 * (T1 / Y) * 10000} color="var(--text)" />
      <Point x={T2} y={iv2 * iv2 * (T2 / Y) * 10000} color="var(--text)" />
    </PlotFrame>
  );

  const ivMax = Math.max(0.3, ...DAYS.map((d) => ivWithEvent(d / Y, base, v, T_EVENT / Y)).filter((x) => x < 2)) * 1.15;
  const bottom = (
    <div style={{ borderTop: '1px solid var(--border)' }}>
      <PlotFrame x={[0, T_MAX]} y={[0, ivMax]} height={170} xTicks={[0, 3, 5, 8, 10, 15]} yTicks={niceTicks(0, ivMax, 3)} formatX={(d) => `${d}d`} formatY={(x) => `${(x * 100).toFixed(0)}%`} xLabel="days to expiry" yLabel="implied volatility" marginLeft={40}>
        <Polyline points={DAYS.filter((d) => d <= T_EVENT).map((d) => [d, ivWithEvent(d / Y, base, v, T_EVENT / Y)] as [number, number])} color="var(--c-vol)" weight={2.5} fillOpacity={0} />
        <Polyline points={DAYS.filter((d) => d > T_EVENT).map((d) => [d, Math.min(ivWithEvent(d / Y, base, v, T_EVENT / Y), ivMax)] as [number, number])} color="var(--c-vol)" weight={2.5} fillOpacity={0} />
        <Point x={T1} y={iv1} color="var(--text)" />
        <Label x={T1} y={iv1} attach="s" attachDistance={8} size={11} color="var(--text)">{`${(iv1 * 100).toFixed(0)}%`}</Label>
        <Point x={T2} y={iv2} color="var(--text)" />
        <Label x={T2} y={iv2} attach="ne" attachDistance={6} size={11} color="var(--text)">{`${(iv2 * 100).toFixed(0)}%`}</Label>
      </PlotFrame>
    </div>
  );

  return (
    <WidgetFrame
      title={title}
      ariaLabel={`An expiry before earnings at ${(iv1 * 100).toFixed(0)}% and one after at ${(iv2 * 100).toFixed(0)}% imply an earnings-day move of ${(move.sd * 100).toFixed(1)}% (one standard deviation).`}
      plotHeight={340}
      plot={<>{top}{bottom}</>}
      controls={
        <>
          <Slider label="Implied vol, expiry before earnings (3 days)" value={iv1} min={0.15} max={0.5} step={0.01} onChange={setIv1} format={(x) => `${(x * 100).toFixed(0)}%`} color="var(--c-vol)" />
          <Slider label="Implied vol, expiry after earnings (8 days)" value={iv2} min={0.15} max={0.8} step={0.01} onChange={setIv2} format={(x) => `${(x * 100).toFixed(0)}%`} color="var(--c-vol)" />
          <Slider label="Normal-day volatility" value={base} min={0.1} max={0.5} step={0.01} onChange={setBase} format={(x) => `${(x * 100).toFixed(0)}%`} />
        </>
      }
      readout={
        <dl className="readout-grid">
          <dt>Event variance</dt><dd>{(v * 10000).toFixed(1)} ×10⁻⁴ <span className="muted">{v === 0 ? '(the inputs leave no room for an event)' : ''}</span></dd>
          <dt>Implied move</dt><dd>±{(move.sd * 100).toFixed(1)}% <span className="muted">one standard deviation; {(move.expectedAbs * 100).toFixed(1)}% expected absolute move</span></dd>
          <dt>Share of 8-day variance</dt><dd>{((v / (iv2 * iv2 * (T2 / Y))) * 100).toFixed(0)}% <span className="muted">comes from the one event</span></dd>
        </dl>
      }
      caption="A stock reports earnings after the close on day 3. One expiry is before the report (3 trading days) and one after (8 days). The top panel shows total implied variance, which grows steadily on normal days and jumps at the event; the dots are the two expiries' σ²T. Below, the implied volatility that this variance curve implies for every expiry."
    />
  );
}
