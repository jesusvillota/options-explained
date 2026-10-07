import { Line, MovablePoint, Point, Polyline } from 'mafs';
import { useState } from 'react';
import { DEFAULTS, price } from '../../lib/pricing/blackScholes';
import { breakeven, type OptionType, type Side } from '../../lib/pricing/payoff';
import { Segmented, Slider } from '../ui/controls';
import { WidgetFrame } from '../ui/WidgetFrame';
import { useTweened } from './animation';
import { clamp, money, signedMoney } from './format';
import { Label, PlotFrame, Sub } from './PlotFrame';

type Mode = 'payoff' | 'profit';

interface PayoffDiagramProps {
  title?: string;
  caption?: string;
  type?: OptionType;
  side?: Side;
  mode?: Mode;
  /** Which toggles the reader sees. */
  typeToggle?: boolean;
  sideToggle?: boolean;
  modeToggle?: boolean;
  /** Let the reader drag the strike. */
  strikeMovable?: boolean;
  /** Ghost the opposite position (long ↔ short) to show they mirror each other. */
  showMirror?: boolean;
  /** Show the max gain / max loss / breakeven summary. */
  showSummary?: boolean;
  initialStrike?: number;
  initialSpot?: number;
}

const X: [number, number] = [40, 160];
const Y: [number, number] = [-70, 70];
const K_RANGE: [number, number] = [60, 140];
const HEIGHT = 360;

/** Put a point's label where the line isn't: above-left of a rising line, above-right of a falling one. */
function labelSide(slope: number, y: number): 'n' | 's' | 'nw' | 'ne' | 'sw' | 'se' {
  const top = y > 45;
  if (slope > 0.1) return top ? 'se' : 'nw';
  if (slope < -0.1) return top ? 'sw' : 'ne';
  return top ? 's' : 'n';
}

/**
 * Chapter 2: payoff and profit at expiry for a single option position.
 * Toggles morph the picture (call ↔ put, long ↔ short, payoff ↔ profit) so the
 * reader sees how each diagram is a transformation of another.
 */
export default function PayoffDiagram({
  title = 'Payoff diagram',
  caption,
  type: initialType = 'call',
  side: initialSide = 'long',
  mode: initialMode = 'payoff',
  typeToggle = true,
  sideToggle = true,
  modeToggle = true,
  strikeMovable = true,
  showMirror = false,
  showSummary = true,
  initialStrike = 100,
  initialSpot = 125,
}: PayoffDiagramProps) {
  const [type, setType] = useState<OptionType>(initialType);
  const [side, setSide] = useState<Side>(initialSide);
  const [mode, setMode] = useState<Mode>(initialMode);
  const [strike, setStrike] = useState(initialStrike);
  const [spot, setSpot] = useState(initialSpot);

  // Premiums from the course's default market (S = 100, r = 5%, σ = 20%, T = 1 year).
  const callPremium = price('call', { ...DEFAULTS, K: strike });
  const putPremium = price('put', { ...DEFAULTS, K: strike });
  const premium = type === 'call' ? callPremium : putPremium;

  // Animated parameters: a = 0 call … 1 put; sign = +1 long … −1 short; m = 0 payoff … 1 profit.
  const a = useTweened(type === 'put' ? 1 : 0);
  const sign = useTweened(side === 'long' ? 1 : -1);
  const m = useTweened(mode === 'profit' ? 1 : 0);

  const curve = (s: number, sg = sign, mm = m) => {
    const pay = (1 - a) * Math.max(s - strike, 0) + a * Math.max(strike - s, 0);
    const prem = (1 - a) * callPremium + a * putPremium;
    return sg * (pay - mm * prem);
  };
  /** Height of the kink for a given strike (where the strike handle sits). */
  const kinkY = (k: number) => {
    const prem = (1 - a) * price('call', { ...DEFAULTS, K: k }) + a * price('put', { ...DEFAULTS, K: k });
    return -sign * m * prem;
  };
  const slopeAt = (x: number) => curve(x + 0.5) - curve(x - 0.5);
  const polyline = (sg: number, mm: number) => [X[0], strike, X[1]].map((s) => [s, curve(s, sg, mm)] as [number, number]);

  const color = type === 'call' ? 'var(--c-call)' : 'var(--c-put)';
  const s = sign > 0 ? 1 : -1;
  const payoffAtSpot = s * (type === 'call' ? Math.max(spot - strike, 0) : Math.max(strike - spot, 0));
  const profitAtSpot = payoffAtSpot - s * premium;
  const be = breakeven(type, strike, premium);
  const label = `${side === 'long' ? 'Long' : 'Short'} ${type}`;
  const yAt = curve(spot);

  const plot = (
    <PlotFrame
      x={X}
      y={Y}
      height={HEIGHT}
      xTicks={[40, 60, 80, 100, 120, 140, 160]}
      yTicks={[-60, -40, -20, 0, 20, 40, 60]}
      formatX={(v) => `$${v}`}
      formatY={(v) => (v > 0 ? `+${v}` : v < 0 ? `−${-v}` : '0')}
      baseline={0}
      xLabel={<>stock price at expiry <Sub base="S" sub="T" /></>}
      yLabel={mode === 'profit' ? 'profit ($)' : 'payoff ($)'}
    >
      {/* Strike */}
      <Line.Segment point1={[strike, Y[0]]} point2={[strike, Y[1]]} color="var(--c-strike)" style="dashed" weight={1.5} opacity={0.6} />
      {/* Ghosts: the opposite position, or the payoff behind the profit */}
      {showMirror && <Polyline points={polyline(-sign, m)} color={color} weight={2.5} fillOpacity={0} strokeOpacity={0.35} strokeStyle="dashed" />}
      {!showMirror && m > 0.01 && <Polyline points={polyline(sign, 0)} color={color} weight={2} fillOpacity={0} strokeOpacity={0.3 * m} strokeStyle="dashed" />}
      {/* The position */}
      <Polyline points={polyline(sign, m)} color={color} weight={4} fillOpacity={0} />
      {mode === 'profit' && m > 0.99 && be > X[0] && be < X[1] && (
        <>
          <Point x={be} y={0} color="var(--text)" />
          <Label x={be} y={0} attach={slopeAt(be) > 0 ? 'se' : 'sw'} attachDistance={10} size={12} color="var(--text)">
            breakeven
          </Label>
        </>
      )}
      {/* Reader's chosen S_T */}
      <Line.Segment point1={[spot, 0]} point2={[spot, yAt]} color="var(--c-spot)" style="dashed" weight={1.5} />
      <Label x={spot} y={yAt} attach={labelSide(slopeAt(spot), yAt)} attachDistance={18} size={13} color="var(--c-spot)">
        {signedMoney(mode === 'profit' ? profitAtSpot : payoffAtSpot)}
      </Label>
      <MovablePoint
        point={[spot, yAt]}
        color="var(--c-spot)"
        onMove={([x]) => setSpot(Math.round(clamp(x, ...X)))}
        constrain={([x]) => {
          const xc = clamp(x, ...X);
          return [xc, curve(xc)];
        }}
      />
      {/* The strike sits at the kink: drag the kink to move it. */}
      {strikeMovable ? (
        <MovablePoint
          point={[strike, kinkY(strike)]}
          color="var(--c-strike)"
          onMove={([x]) => setStrike(Math.round(clamp(x, ...K_RANGE)))}
          constrain={([x]) => {
            const k = clamp(x, ...K_RANGE);
            return [k, kinkY(k)];
          }}
        />
      ) : (
        <Point x={strike} y={kinkY(strike)} color="var(--c-strike)" />
      )}
      <Label x={strike} y={kinkY(strike)} attach={sign > 0 ? 's' : 'n'} attachDistance={20} size={13} color="var(--c-strike)">
        <tspan fontStyle="italic">K</tspan> = ${strike}
      </Label>
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
      {sideToggle && (
        <Segmented label="Position" value={side} onChange={setSide} options={[
          { value: 'long', label: 'Long (buy)' },
          { value: 'short', label: 'Short (sell)' },
        ]} />
      )}
      {modeToggle && (
        <Segmented label="Show" value={mode} onChange={setMode} options={[
          { value: 'payoff', label: 'Payoff' },
          { value: 'profit', label: 'Profit' },
        ]} />
      )}
      <Slider label="Stock price at expiry $\Spot{S_T}$" value={spot} min={X[0]} max={X[1]} onChange={setSpot} format={(v) => `$${v}`} color="var(--c-spot)" />
      {strikeMovable && (
        <Slider label="Strike $\Strike{K}$" value={strike} min={K_RANGE[0]} max={K_RANGE[1]} onChange={setStrike} format={(v) => `$${v}`} color="var(--c-strike)" />
      )}
    </>
  );

  const unlimited = <span>unlimited</span>;
  const maxGain = type === 'call' ? (side === 'long' ? unlimited : money(premium)) : side === 'long' ? money(strike - premium) : money(premium);
  const maxLoss = type === 'call' ? (side === 'long' ? money(premium) : unlimited) : side === 'long' ? money(premium) : money(strike - premium);

  const readout = (
    <>
      <p>
        <strong style={{ color }}>{label}</strong>, strike <span className="num">${strike}</span>, premium{' '}
        <span className="num">{money(premium)}</span> {side === 'long' ? 'paid' : 'received'} today.
      </p>
      <p>
        If the stock ends at <strong className="num" style={{ color: 'var(--c-spot)' }}>${spot}</strong>: payoff{' '}
        <strong className={`num ${payoffAtSpot > 0 ? 'good' : payoffAtSpot < 0 ? 'bad' : ''}`}>{signedMoney(payoffAtSpot)}</strong>, profit{' '}
        <strong className={`num ${profitAtSpot > 0 ? 'good' : profitAtSpot < 0 ? 'bad' : ''}`}>{signedMoney(profitAtSpot)}</strong>.
      </p>
      {showSummary && (
        <dl className="readout-grid" style={{ marginTop: '0.6rem' }}>
          <dt>Best case (profit)</dt><dd className="good">{maxGain}</dd>
          <dt>Worst case (loss)</dt><dd className="bad">{maxLoss}</dd>
          <dt>Breakeven</dt><dd>{money(be)}</dd>
        </dl>
      )}
    </>
  );

  return (
    <WidgetFrame
      title={title}
      ariaLabel={`${mode} diagram of a ${label.toLowerCase()} with strike $${strike}: the line is flat on one side of the strike and slopes on the other.`}
      plotHeight={HEIGHT}
      plot={plot}
      controls={controls}
      readout={readout}
      caption={caption ?? 'Drag the blue point along the line to pick a stock price at expiry, and the yellow point at the kink to move the strike.'}
    />
  );
}
