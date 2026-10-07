import { Line, MovablePoint, Point, Polyline } from 'mafs';
import { useState } from 'react';
import { payoff, type OptionType } from '../../lib/pricing/payoff';
import { Segmented, Slider } from '../ui/controls';
import { WidgetFrame } from '../ui/WidgetFrame';
import { clamp, money } from './format';
import { Label, PlotFrame } from './PlotFrame';

interface ConvexityChordProps {
  title?: string;
  caption?: string;
  type?: OptionType;
  typeToggle?: boolean;
  initialSpot?: number;
  initialMove?: number;
}

const K = 100;
// Keep both futures on screen: S ± move stays within [30, 170].
const X: [number, number] = [30, 170];
const MAX_MOVE = 30;
const Y: [number, number] = [-8, 72];
const S_RANGE: [number, number] = [X[0] + MAX_MOVE, X[1] - MAX_MOVE];
const HEIGHT = 330;

/**
 * Chapter 3: why waiting is worth something. The stock can move up or down by
 * the same amount with equal chances. Because the payoff bends at the strike,
 * the average of the two outcomes (the chord's midpoint) sits above the payoff
 * at today's price. The gap is the option's time value.
 */
export default function ConvexityChord({
  title = 'Two possible futures',
  caption,
  type: initialType = 'call',
  typeToggle = false,
  initialSpot = 110,
  initialMove = 20,
}: ConvexityChordProps) {
  const [type, setType] = useState<OptionType>(initialType);
  const [spot, setSpot] = useState(initialSpot);
  const [move, setMove] = useState(initialMove);

  const f = (s: number) => payoff(type, s, K);
  const up = spot + move;
  const down = spot - move;
  const average = (f(up) + f(down)) / 2;
  const now = f(spot);
  const gap = average - now;
  const color = type === 'call' ? 'var(--c-call)' : 'var(--c-put)';

  const plot = (
    <PlotFrame
      x={X}
      y={Y}
      height={HEIGHT}
      xTicks={[40, 60, 80, 100, 120, 140, 160]}
      yTicks={[0, 20, 40, 60]}
      formatX={(v) => `$${v}`}
      formatY={(v) => `$${v}`}
      baseline={0}
      xLabel="stock price"
      yLabel="value if exercised"
    >
      <Line.Segment point1={[K, Y[0]]} point2={[K, Y[1]]} color="var(--c-strike)" style="dashed" weight={1.5} opacity={0.6} />
      <Polyline points={[[X[0], f(X[0])], [K, 0], [X[1], f(X[1])]]} color={color} weight={3.5} fillOpacity={0} />
      {/* The two futures and the chord between them */}
      <Line.Segment point1={[down, f(down)]} point2={[up, f(up)]} color="var(--text-muted)" style="dashed" weight={2} />
      <Line.Segment point1={[down, 0]} point2={[down, f(down)]} color="var(--c-spot)" style="dashed" weight={1} opacity={0.5} />
      <Line.Segment point1={[up, 0]} point2={[up, f(up)]} color="var(--c-spot)" style="dashed" weight={1} opacity={0.5} />
      <Point x={down} y={f(down)} color="var(--c-spot)" />
      <Point x={up} y={f(up)} color="var(--c-spot)" />
      <Label x={down} y={f(down)} attach={type === 'call' ? 's' : 'ne'} attachDistance={12} size={12} color="var(--c-spot)">
        down: ${down}
      </Label>
      <Label x={up} y={f(up)} attach={type === 'call' ? 'nw' : 's'} attachDistance={12} size={12} color="var(--c-spot)">
        up: ${up}
      </Label>
      {/* Time value: the gap between the average outcome and exercising now */}
      {gap > 0.05 && <Line.Segment point1={[spot, now]} point2={[spot, average]} color="var(--c-time)" weight={5} />}
      <Point x={spot} y={average} color="var(--text)" />
      <Label x={spot} y={average} attach={type === 'call' ? 'nw' : 'ne'} attachDistance={12} size={12} color="var(--text)">
        average {money(average)}
      </Label>
      {gap > 0.05 && (
        <Label x={spot} y={(now + average) / 2} attach={type === 'call' ? 'w' : 'e'} attachDistance={10} size={12} color="var(--c-time)">
          time value {money(gap)}
        </Label>
      )}
      <MovablePoint
        point={[spot, now]}
        color={color}
        onMove={([x]) => setSpot(Math.round(clamp(x, ...S_RANGE)))}
        constrain={([x]) => {
          const s = clamp(x, ...S_RANGE);
          return [s, f(s)];
        }}
      />
    </PlotFrame>
  );

  const controls = (
    <>
      {typeToggle && (
        <Segmented label="Option type" value={type} onChange={setType} options={[
          { value: 'call', label: 'Call', color: 'var(--c-call)' },
          { value: 'put', label: 'Put', color: 'var(--c-put)' },
        ]} />
      )}
      <Slider label="Stock price today $\Spot{S}$" value={spot} min={S_RANGE[0]} max={S_RANGE[1]} onChange={setSpot} format={(v) => `$${v}`} color="var(--c-spot)" />
      <Slider label="How far it can move by expiry, up or down" value={move} min={0} max={MAX_MOVE} onChange={setMove} format={(v) => `±$${v}`} color="var(--c-vol)" />
    </>
  );

  const readout = (
    <>
      <p>
        Exercise today: <strong className="num">{money(now)}</strong>. Wait: the stock ends at{' '}
        <span className="num">${up}</span> or <span className="num">${down}</span>, so the {type} pays{' '}
        <span className="num">{money(f(up))}</span> or <span className="num">{money(f(down))}</span>, which is{' '}
        <strong className="num">{money(average)}</strong> on average.
      </p>
      <p>
        {gap > 0.005 ? (
          <>Waiting is worth <strong className="num" style={{ color: 'var(--c-time)' }}>{money(gap)}</strong> more: that's the time value.</>
        ) : (
          <>Both futures land on the same straight piece of the hockey stick, so waiting adds nothing.</>
        )}
      </p>
    </>
  );

  return (
    <WidgetFrame
      title={title}
      ariaLabel={`Hockey stick for a ${type} with strike $${K}. Today's price $${spot}; the stock can end at $${down} or $${up}. The average payoff is $${average.toFixed(2)}, versus $${now.toFixed(2)} from exercising now.`}
      plotHeight={HEIGHT}
      plot={plot}
      controls={controls}
      readout={readout}
      caption={caption ?? 'Drag the point along the hockey stick to change today\'s price, and widen the move with the purple slider.'}
    />
  );
}
