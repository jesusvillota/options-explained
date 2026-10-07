import { MovablePoint, Polygon, Polyline } from 'mafs';
import { useState } from 'react';
import { DEFAULTS, price } from '../../lib/pricing/blackScholes';
import { boundViolation, optionBounds } from '../../lib/pricing/bounds';
import type { OptionType } from '../../lib/pricing/payoff';
import { Segmented, Slider } from '../ui/controls';
import { RichText } from '../ui/Tex';
import { WidgetFrame } from '../ui/WidgetFrame';
import { clamp, money } from './format';
import { Label, PlotFrame } from './PlotFrame';

const X: [number, number] = [0, 140];
const Y: [number, number] = [-5, 145];
const HEIGHT = 340;
const xs = Array.from({ length: 91 }, (_, i) => (i * X[1]) / 90);

interface BoundsRegionProps {
  type?: OptionType;
  initialSpot?: number;
  initialPrice?: number;
  title?: string;
}

/**
 * Chapter 7: the band of prices an option can have without creating an
 * arbitrage, drawn against the stock price. Black–Scholes lives inside it.
 * Drag the "market price" outside the band and the free lunch appears.
 */
export default function BoundsRegion({ type: initialType = 'call', initialSpot = 100, initialPrice = 30, title = 'The no-arbitrage band' }: BoundsRegionProps) {
  const [type, setType] = useState<OptionType>(initialType);
  const [T, setT] = useState(1);
  const [r, setR] = useState(0.05);
  const [pt, setPt] = useState<[number, number]>([initialSpot, initialPrice]);
  const market = { ...DEFAULTS, T, r };
  const at = (S: number) => optionBounds(type, { ...market, S });
  const color = type === 'call' ? 'var(--c-call)' : 'var(--c-put)';

  const upper = xs.map((S) => [S, at(S).upper] as [number, number]);
  const lower = xs.map((S) => [S, at(S).lower] as [number, number]);
  const bs = xs.map((S) => [S, price(type, { ...market, S: Math.max(S, 0.01) })] as [number, number]);
  const [S, P] = pt;
  const here = at(S);
  const violation = boundViolation(type, { ...market, S }, P, 0.005);
  const fair = price(type, { ...market, S: Math.max(S, 0.01) });

  const plot = (
    <PlotFrame
      x={X}
      y={Y}
      height={HEIGHT}
      xTicks={[0, 20, 40, 60, 80, 100, 120, 140]}
      yTicks={[0, 25, 50, 75, 100, 125]}
      formatX={(v) => `$${v}`}
      formatY={(v) => `$${v}`}
      baseline={0}
      xLabel="stock price today"
      yLabel={`${type} price`}
    >
      <Polygon points={[...upper, ...[...lower].reverse()]} color={color} fillOpacity={0.12} strokeOpacity={0} weight={0} />
      <Polyline points={upper} color="var(--text-muted)" weight={2} fillOpacity={0} />
      <Polyline points={lower} color="var(--text-muted)" weight={2} fillOpacity={0} />
      <Polyline points={bs} color={color} weight={3} strokeStyle="dashed" fillOpacity={0} />
      <Label x={type === 'call' ? 110 : 15} y={type === 'call' ? at(110).upper : at(15).upper} attach={type === 'call' ? 'nw' : 'ne'} attachDistance={8} size={12} color="var(--text-muted)">
        upper bound
      </Label>
      <Label x={type === 'call' ? 130 : 110} y={type === 'call' ? at(130).lower : 0} attach={type === 'call' ? 'se' : 'n'} attachDistance={8} size={12} color="var(--text-muted)">
        lower bound
      </Label>
      <MovablePoint
        point={pt}
        color={violation ? 'var(--c-put)' : 'var(--c-spot)'}
        onMove={([x, y]) => setPt([Math.round(clamp(x, 1, X[1])), Math.round(clamp(y, 0, Y[1] - 5) * 2) / 2])}
      />
      <Label x={S} y={P} attach={P > Y[1] - 25 ? 's' : 'n'} attachDistance={16} size={12} color={violation ? 'var(--c-put)' : 'var(--c-spot)'}>
        market {money(P)}
      </Label>
    </PlotFrame>
  );

  return (
    <WidgetFrame
      title={title}
      ariaLabel={`No-arbitrage band for a ${type} with strike $100: at a stock price of $${S}, the price must lie between ${money(here.lower)} and ${money(here.upper)}. The market point at ${money(P)} is ${violation ? 'outside' : 'inside'} it.`}
      plotHeight={HEIGHT}
      plot={plot}
      controls={
        <>
          <Segmented label="Option type" value={type} onChange={(t) => { setType(t); setPt([S, t === 'call' ? 30 : 10]); }} options={[
            { value: 'call', label: 'Call', color: 'var(--c-call)' },
            { value: 'put', label: 'Put', color: 'var(--c-put)' },
          ]} />
          <Slider label="Time to expiry $\Time{T}$" value={T} min={0.02} max={5} step={0.02} onChange={setT} format={(v) => `${v.toFixed(2)} yr`} color="var(--c-time)" />
          <Slider label="Interest rate $\Rate{r}$" value={r} min={0} max={0.15} step={0.005} onChange={setR} format={(v) => `${(v * 100).toFixed(1)}%`} color="var(--c-rate)" />
        </>
      }
      readout={
        <>
          <p>
            Stock at <span className="num">${S}</span>: any {type} price between <strong className="num">{money(here.lower)}</strong> and{' '}
            <strong className="num">{money(here.upper)}</strong> is arbitrage-free. Black–Scholes says <span className="num">{money(fair)}</span>.
          </p>
          {violation ? (
            <p>
              <strong className="bad">Market price {money(P)} is {violation.bound === 'upper' ? 'above the upper' : 'below the lower'} bound:</strong>{' '}
              lock in <strong className="good num">{money(violation.profitToday)}</strong> today. <RichText>{violation.trade.replace('K e^{−rT}', '$\\Strike{K}e^{-\\Rate{r}\\Time{T}}$')}</RichText>
            </p>
          ) : (
            <p className="muted">The market price {money(P)} is inside the band, so no model-free arbitrage. (It could still be "wrong" by a model's standards.)</p>
          )}
        </>
      }
      caption="Shaded: every price that doesn't allow a riskless profit. Dashed: the Black–Scholes price, comfortably inside. Drag the point to quote a market price."
    />
  );
}
