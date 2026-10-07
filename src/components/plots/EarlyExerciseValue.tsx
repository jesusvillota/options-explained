import { Line, MovablePoint, Polyline } from 'mafs';
import { useMemo, useState } from 'react';
import { binomialPrice } from '../../lib/pricing/binomial';
import { DEFAULTS, price } from '../../lib/pricing/blackScholes';
import { payoff, type OptionType } from '../../lib/pricing/payoff';
import { Segmented, Slider } from '../ui/controls';
import { WidgetFrame } from '../ui/WidgetFrame';
import { clamp, money } from './format';
import { Label, PlotFrame } from './PlotFrame';

const X: [number, number] = [40, 160];
const Y: [number, number] = [-4, 64];
const HEIGHT = 320;
const STEPS = 150;
const xs = Array.from({ length: 61 }, (_, i) => X[0] + i * 2);

interface Props {
  type?: OptionType;
  initialSpot?: number;
  initialQ?: number;
  title?: string;
}

/**
 * Chapter 9: American value (binomial tree) vs European value (Black–Scholes)
 * vs the payoff. Where the American curve sits on the payoff, exercising now
 * is optimal; the gap between American and European is the early-exercise premium.
 */
export default function EarlyExerciseValue({ type: initialType = 'put', initialSpot = 75, initialQ = 0, title = 'American vs European' }: Props) {
  const [type, setType] = useState<OptionType>(initialType);
  const [r, setR] = useState(0.05);
  const [q, setQ] = useState(initialQ);
  const [T, setT] = useState(1);
  const [spot, setSpot] = useState(initialSpot);
  const market = { ...DEFAULTS, r, q, T };
  const am = useMemo(() => xs.map((S) => binomialPrice(type, { ...market, S, steps: STEPS, american: true })), [type, r, q, T]);
  const eu = xs.map((S) => price(type, { ...market, S }));
  const exerciseXs = xs.filter((S, i) => payoff(type, S, 100) > 0 && am[i] - payoff(type, S, 100) < 1e-9 * 100);
  const color = type === 'call' ? 'var(--c-call)' : 'var(--c-put)';

  const amAt = binomialPrice(type, { ...market, S: spot, steps: STEPS, american: true });
  const euAt = price(type, { ...market, S: spot });
  const ex = payoff(type, spot, 100);
  const exerciseNow = ex > 0 && amAt - ex < 1e-9 * 100;

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
      xLabel="stock price today"
      yLabel="option value"
    >
      {exerciseXs.length > 0 && (
        <Line.Segment
          point1={[Math.min(...exerciseXs), Y[0] + 1.5]}
          point2={[Math.max(...exerciseXs), Y[0] + 1.5]}
          color="var(--c-rate)"
          weight={8}
          opacity={0.7}
        />
      )}
      {exerciseXs.length > 0 && (
        <Label x={(Math.min(...exerciseXs) + Math.max(...exerciseXs)) / 2} y={Y[0] + 1.5} attach="n" attachDistance={8} size={12} color="var(--c-rate)">
          exercise now
        </Label>
      )}
      <Polyline points={xs.map((S) => [S, payoff(type, S, 100)] as [number, number])} color="var(--text-muted)" weight={1.5} strokeStyle="dashed" fillOpacity={0} />
      <Polyline points={xs.map((S, i) => [S, eu[i]] as [number, number])} color={color} weight={2} strokeStyle="dashed" fillOpacity={0} strokeOpacity={0.8} />
      <Polyline points={xs.map((S, i) => [S, am[i]] as [number, number])} color={color} weight={4} fillOpacity={0} />
      <Line.Segment point1={[spot, euAt]} point2={[spot, amAt]} color="var(--c-rate)" weight={4} />
      <MovablePoint
        point={[spot, amAt]}
        color="var(--c-spot)"
        onMove={([x]) => setSpot(Math.round(clamp(x, ...X)))}
        constrain={([x]) => {
          const S = Math.round(clamp(x, ...X));
          return [S, binomialPrice(type, { ...market, S, steps: STEPS, american: true })];
        }}
      />
      <Label x={spot} y={amAt} attach={type === 'put' ? 'ne' : 'nw'} attachDistance={14} size={12} color="var(--c-spot)">
        American {money(amAt)}
      </Label>
    </PlotFrame>
  );

  return (
    <WidgetFrame
      title={title}
      ariaLabel={`American ${type} worth ${money(amAt)} versus European ${money(euAt)} at a stock price of $${spot}; ${exerciseNow ? 'exercising now is optimal' : 'holding is better'}.`}
      plotHeight={HEIGHT}
      plot={plot}
      controls={
        <>
          <Segmented label="Option type" value={type} onChange={(t) => { setType(t); setSpot(t === 'put' ? 75 : 130); }} options={[
            { value: 'call', label: 'Call', color: 'var(--c-call)' },
            { value: 'put', label: 'Put', color: 'var(--c-put)' },
          ]} />
          <Slider label="Interest rate $\Rate{r}$" value={r} min={0} max={0.15} step={0.005} onChange={setR} format={(v) => `${(v * 100).toFixed(1)}%`} color="var(--c-rate)" />
          <Slider label="Dividend yield $q$" value={q} min={0} max={0.12} step={0.005} onChange={setQ} format={(v) => `${(v * 100).toFixed(1)}%`} color="var(--text-muted)" />
          <Slider label="Time to expiry $\Time{T}$" value={T} min={0.1} max={3} step={0.1} onChange={setT} format={(v) => `${v.toFixed(1)} yr`} color="var(--c-time)" />
        </>
      }
      readout={
        <>
          <dl className="readout-grid">
            <dt>American</dt><dd>{money(amAt)}</dd>
            <dt>European</dt><dd>{money(euAt)}</dd>
            <dt>Early-exercise premium</dt><dd style={{ color: 'var(--c-rate)' }}>{money(Math.max(amAt - euAt, 0))}</dd>
            <dt>Exercise value now</dt><dd>{money(ex)}</dd>
          </dl>
          <p style={{ marginTop: '0.5rem' }}>
            {exerciseNow ? (
              <strong style={{ color: 'var(--c-rate)' }}>Exercise now: waiting is worth no more than the payoff.</strong>
            ) : ex > 0 ? (
              <span>Keep it: it's worth {money(amAt - ex)} more alive than exercised.</span>
            ) : (
              <span className="muted">Out of the money: nothing to exercise.</span>
            )}
          </p>
        </>
      }
      caption="Thick: American value (binomial tree). Dashed coloured: European value (Black–Scholes). Dashed grey: the payoff if exercised now. Orange: the early-exercise premium, and where exercising is optimal."
    />
  );
}
