import { Line, Point, Polyline } from 'mafs';
import { useEffect, useState } from 'react';
import { payoff } from '../../lib/pricing/payoff';
import { Button } from '../ui/controls';
import { WidgetFrame } from '../ui/WidgetFrame';
import { useTweened } from './animation';
import { Label, PlotFrame, Sub } from './PlotFrame';

const K = 100;
const SCENARIOS = [50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150];
const X: [number, number] = [40, 160];
const HEIGHT = 320;

/**
 * Chapter 2 opener: answer "what is the call worth at expiry?" one scenario at
 * a time, plot each answer as a point, then connect the dots — and the
 * hockey-stick payoff appears.
 */
export default function PayoffTracer() {
  const [shown, setShown] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [connected, setConnected] = useState(false);
  const sweep = useTweened(connected ? 1 : 0, 1400);

  useEffect(() => {
    if (!playing) return;
    if (shown >= SCENARIOS.length) {
      setPlaying(false);
      return;
    }
    const id = setTimeout(() => setShown((n) => n + 1), shown === 0 ? 0 : 650);
    return () => clearTimeout(id);
  }, [playing, shown]);

  const reset = () => {
    setShown(0);
    setPlaying(false);
    setConnected(false);
  };

  const current = shown > 0 ? SCENARIOS[shown - 1] : null;
  const end = X[0] + sweep * (X[1] - X[0]);
  const linePoints: [number, number][] = [[X[0], 0]];
  if (end > K) linePoints.push([K, 0]);
  linePoints.push([end, payoff('call', end, K)]);

  const plot = (
    <PlotFrame
      x={X}
      y={[-10, 65]}
      height={HEIGHT}
      xTicks={[40, 60, 80, 100, 120, 140, 160]}
      yTicks={[0, 20, 40, 60]}
      formatX={(v) => `$${v}`}
      formatY={(v) => `$${v}`}
      baseline={0}
      xLabel={<>stock price at expiry <Sub base="S" sub="T" /></>}
      yLabel="what the call is worth"
    >
      <Line.Segment point1={[K, -10]} point2={[K, 65]} color="var(--c-strike)" style="dashed" weight={1.5} opacity={0.6} />
      <Label x={K} y={60} attach="w" attachDistance={8} size={12} color="var(--c-strike)">
        strike $100
      </Label>
      {sweep > 0 && <Polyline points={linePoints} color="var(--c-call)" weight={4} fillOpacity={0} />}
      {SCENARIOS.slice(0, shown).map((s) => {
        const v = payoff('call', s, K);
        return (
          <g key={s}>
            {s === current && v > 0 && <Line.Segment point1={[s, 0]} point2={[s, v]} color="var(--c-call)" weight={2} style="dashed" />}
            <Point x={s} y={v} color={s === current ? 'var(--c-spot)' : 'var(--c-call)'} />
          </g>
        );
      })}
      {current !== null && !connected && (
        <Label x={current} y={payoff('call', current, K)} attach={current < 75 ? 'ne' : 'nw'} attachDistance={14} size={13} color="var(--c-spot)">
          ${current} → ${payoff('call', current, K)}
        </Label>
      )}
    </PlotFrame>
  );

  const done = shown >= SCENARIOS.length;
  const controls = (
    <>
      <Button onClick={() => setShown((n) => Math.min(n + 1, SCENARIOS.length))} disabled={done || playing}>Next scenario</Button>
      <Button onClick={() => setPlaying(true)} disabled={done || playing}>Play all</Button>
      <Button onClick={() => setConnected(true)} disabled={!done || connected}>Connect the dots</Button>
      <Button onClick={reset} disabled={shown === 0}>Reset</Button>
    </>
  );

  const readout = (
    <>
      <p>
        {current === null
          ? 'A call with strike $100. Step through the possible prices at expiry one at a time.'
          : current > K
            ? `The stock ends at $${current}. Exercise: buy at $100, worth $${current}. The call is worth $${current - K}.`
            : `The stock ends at $${current}. Buying at $100 makes no sense, so the call expires worth $0.`}
      </p>
      {connected && <p className="good">Every possible scenario, all at once: this is the payoff diagram.</p>}
    </>
  );

  return (
    <WidgetFrame
      title="One scenario at a time"
      ariaLabel="Points showing the value at expiry of a call with strike $100 for stock prices from $50 to $150; they lie on a flat line up to $100 and a rising line after it."
      plotHeight={HEIGHT}
      plot={plot}
      controls={controls}
      readout={readout}
    />
  );
}
