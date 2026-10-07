import { Line, MovablePoint, Point, Polyline } from 'mafs';
import { useMemo, useState } from 'react';
import { brownianBridge } from '../../lib/math/rng';
import { DEFAULTS, price } from '../../lib/pricing/blackScholes';
import { payoff, type OptionType } from '../../lib/pricing/payoff';
import { Button, Segmented, Slider } from '../ui/controls';
import { WidgetFrame } from '../ui/WidgetFrame';
import { clamp, money, percent, signedMoney } from './format';
import { Label, PlotFrame, Sub } from './PlotFrame';

interface OptionTimelineProps {
  title?: string;
  caption?: string;
  type?: OptionType;
  /** Let the reader switch between call and put. */
  typeToggle?: boolean;
  /** Let the reader move the strike. */
  strikeSlider?: boolean;
  /** Compare with an obligation (a forward agreement at the same price). */
  showObligation?: boolean;
  /** Compare with simply owning the stock. */
  showStock?: boolean;
  initialSpotAtExpiry?: number;
  seed?: number;
}

const S0 = DEFAULTS.S;
const MONTHS = 12;
const N = 160;
const PRICE_RANGE: [number, number] = [40, 170];
const ST_RANGE: [number, number] = [45, 165];

/**
 * Chapter 1: the life of one option. The stock wanders from today's price to
 * a price at expiry the reader drags; the widget says whether to exercise and
 * what the holder ends up with.
 */
export default function OptionTimeline({
  title = 'The life of an option',
  caption,
  type: initialType = 'call',
  typeToggle = false,
  strikeSlider = false,
  showObligation = false,
  showStock = false,
  initialSpotAtExpiry = 127,
  seed: initialSeed = 11,
}: OptionTimelineProps) {
  const [type, setType] = useState<OptionType>(initialType);
  const [strike, setStrike] = useState(100);
  const [spotT, setSpotT] = useState(initialSpotAtExpiry);
  const [seed, setSeed] = useState(initialSeed);

  const bridge = useMemo(() => brownianBridge(seed, N), [seed]);
  const path = useMemo(() => {
    const a = Math.log(S0);
    const b = Math.log(spotT);
    return bridge.map((w, i) => {
      const t = i / N;
      return [t * MONTHS, Math.exp(a + t * (b - a) + DEFAULTS.sigma * w)] as [number, number];
    });
  }, [bridge, spotT]);

  // Put the strike's label on the side of the dashed line the path isn't on (early in the year).
  const early = path.slice(0, Math.floor(N / 3));
  const strikeLabelBelow = early.reduce((sum, [, y]) => sum + (y - strike), 0) / early.length > 0;

  const premium = price(type, { ...DEFAULTS, K: strike });
  const value = payoff(type, spotT, strike);
  const exercise = value > 0;
  const profit = value - premium;
  const color = type === 'call' ? 'var(--c-call)' : 'var(--c-put)';
  const buySell = type === 'call' ? 'buy' : 'sell';
  const obligation = type === 'call' ? spotT - strike : strike - spotT;

  const plot = (
    <PlotFrame
      x={[0, MONTHS]}
      y={PRICE_RANGE}
      height={340}
      xTicks={[0, 3, 6, 9, 12]}
      yTicks={[50, 75, 100, 125, 150]}
      formatX={(m) => (m === 0 ? 'today' : m === MONTHS ? 'expiry' : `${m} mo`)}
      formatY={(v) => `$${v}`}
    >
      <Line.Segment point1={[0, strike]} point2={[MONTHS, strike]} color="var(--c-strike)" style="dashed" weight={2} />
      <Label x={0.15} y={strike} attach={strikeLabelBelow ? 'se' : 'ne'} attachDistance={8} size={13} color="var(--c-strike)">
        strike <tspan fontStyle="italic">K</tspan> = ${strike}
      </Label>
      <Line.Segment point1={[MONTHS, PRICE_RANGE[0]]} point2={[MONTHS, PRICE_RANGE[1]]} color="var(--c-time)" style="dashed" weight={1.5} opacity={0.7} />
      <Polyline points={path} color="var(--c-spot)" weight={2.5} fillOpacity={0} />
      <Point x={0} y={S0} color="var(--c-spot)" />
      {value > 0 && (
        <>
          <Line.Segment point1={[MONTHS, strike]} point2={[MONTHS, spotT]} color={color} weight={7} />
          <Label x={MONTHS} y={(strike + spotT) / 2} attach="w" attachDistance={14} size={14} color={color}>
            payoff {money(value)}
          </Label>
        </>
      )}
      <Label x={MONTHS} y={spotT} attach={spotT > strike ? 'nw' : 'sw'} attachDistance={12} size={13} color="var(--c-spot)">
        <Sub base="S" sub="T" />= ${spotT}
      </Label>
      <MovablePoint
        point={[MONTHS, spotT]}
        color="var(--c-spot)"
        onMove={([, y]) => setSpotT(Math.round(clamp(y, ...ST_RANGE)))}
        constrain={([, y]) => [MONTHS, clamp(y, ...ST_RANGE)]}
      />
    </PlotFrame>
  );

  const controls = (
    <>
      {typeToggle && (
        <Segmented
          label="Option type"
          value={type}
          onChange={setType}
          options={[
            { value: 'call', label: 'Call (right to buy)', color: 'var(--c-call)' },
            { value: 'put', label: 'Put (right to sell)', color: 'var(--c-put)' },
          ]}
        />
      )}
      <Slider label="Stock price at expiry $\Spot{S_T}$" value={spotT} min={ST_RANGE[0]} max={ST_RANGE[1]} onChange={setSpotT} format={(v) => `$${v}`} color="var(--c-spot)" />
      {strikeSlider && (
        <Slider label="Strike $\Strike{K}$" value={strike} min={60} max={140} onChange={setStrike} format={(v) => `$${v}`} color="var(--c-strike)" />
      )}
      <Button onClick={() => setSeed((s) => s + 1)}>New random path</Button>
    </>
  );

  const readout = (
    <>
      <p>
        {exercise ? (
          <>
            <strong className="good">Exercise.</strong> You {buySell} for <span className="num">${strike}</span> a share that is worth{' '}
            <span className="num">${spotT}</span>. Payoff: <strong className="num">{money(value)}</strong>.
          </>
        ) : (
          <>
            <strong className="muted">Let it expire.</strong> Why {buySell} for <span className="num">${strike}</span> a share{' '}
            {type === 'call' ? 'you could buy for' : 'you could sell for'} <span className="num">${spotT}</span>? Payoff: <strong className="num">$0</strong>.
          </>
        )}
      </p>
      <p>
        You paid <span className="num">{money(premium)}</span> for the option today, so your net result is{' '}
        <strong className={`num ${profit >= 0 ? 'good' : 'bad'}`}>{signedMoney(profit)}</strong>
        {profit < 0 && !exercise ? ' — the most you can ever lose.' : '.'}
      </p>
      {showObligation && (
        <p>
          With an <em>obligation</em> to {buySell} at <span className="num">${strike}</span> instead, you would get{' '}
          <strong className={`num ${obligation >= 0 ? 'good' : 'bad'}`}>{signedMoney(obligation)}</strong>
          {obligation < 0 ? ' — no walking away.' : '.'}
        </p>
      )}
      {showStock && type === 'call' && (
        <p className="muted">
          Return on the money you put in: option <strong className={profit >= 0 ? 'good' : 'bad'}>{percent(profit / premium)}</strong>, versus{' '}
          <strong className={spotT >= S0 ? 'good' : 'bad'}>{percent(spotT / S0 - 1)}</strong> for buying the stock at ${S0}.
        </p>
      )}
    </>
  );

  return (
    <WidgetFrame
      title={title}
      ariaLabel={`A stock price path from $${S0} today to $${spotT} at expiry, with the strike at $${strike}. The ${type} ${exercise ? 'is exercised' : 'expires worthless'}.`}
      plotHeight={340}
      plot={plot}
      controls={controls}
      readout={readout}
      caption={caption ?? 'Drag the blue point at expiry (or use the slider) to choose where the stock ends up.'}
    />
  );
}
