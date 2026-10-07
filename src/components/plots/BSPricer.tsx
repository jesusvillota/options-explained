import { useState } from 'react';
import { cdf } from '../../lib/math/normal';
import { d1d2, greeks, price } from '../../lib/pricing/blackScholes';
import { moneyness, payoff, type OptionType } from '../../lib/pricing/payoff';
import { Segmented, Slider } from '../ui/controls';
import { WidgetFrame } from '../ui/WidgetFrame';
import { money } from './format';
import { Heatmap } from './Heatmap';

/**
 * Chapter 20: the full Black–Scholes pricer. Every input on a slider, the
 * decomposition into intrinsic and time value, a first look at the Greeks, and
 * the price as a colour map over stock price and time to expiry.
 */
export default function BSPricer() {
  const [type, setType] = useState<OptionType>('call');
  const [S, setS] = useState(100);
  const [K, setK] = useState(100);
  const [T, setT] = useState(1);
  const [sigma, setSigma] = useState(0.2);
  const [r, setR] = useState(0.05);
  const [q, setQ] = useState(0);
  const input = { S, K, T, sigma, r, q };
  const v = price(type, input);
  const iv = payoff(type, S, K);
  const g = T > 0 ? greeks(type, input) : null;
  const { d1, d2 } = d1d2(input);
  const color = type === 'call' ? '--c-call' : '--c-put';

  return (
    <WidgetFrame
      title="The Black–Scholes playground"
      ariaLabel={`Black–Scholes ${type} price ${money(v)} for S = ${S}, K = ${K}, T = ${T}, volatility ${Math.round(sigma * 100)}%, rate ${(r * 100).toFixed(1)}%.`}
      plotHeight={330}
      plot={
        <Heatmap
          f={(s, tau) => price(type, { ...input, S: s, T: tau })}
          x={[40, 180]}
          y={[0.01, 3]}
          height={330}
          color={color}
          xTicks={[50, 75, 100, 125, 150, 175]}
          yTicks={[0.5, 1, 1.5, 2, 2.5, 3]}
          formatX={(s) => `$${Math.round(s)}`}
          formatY={(t) => `${t.toFixed(1)} yr`}
          formatValue={(val) => money(val)}
          xLabel="stock price S"
          yLabel="time to expiry ↑"
          marker={[S, Math.max(T, 0.01)]}
        />
      }
      controls={
        <>
          <Segmented label="Option type" value={type} onChange={setType} options={[
            { value: 'call', label: 'Call', color: 'var(--c-call)' },
            { value: 'put', label: 'Put', color: 'var(--c-put)' },
          ]} />
          <Slider label="Stock $\Spot{S}$" value={S} min={40} max={180} onChange={setS} format={(x) => `$${x}`} color="var(--c-spot)" />
          <Slider label="Strike $\Strike{K}$" value={K} min={50} max={150} onChange={setK} format={(x) => `$${x}`} color="var(--c-strike)" />
          <Slider label="Time $\Time{T}$" value={T} min={0.01} max={3} step={0.01} onChange={setT} format={(x) => `${x.toFixed(2)} yr`} color="var(--c-time)" />
          <Slider label="Volatility $\Vol{\sigma}$" value={sigma} min={0.01} max={1} step={0.01} onChange={setSigma} format={(x) => `${Math.round(x * 100)}%`} color="var(--c-vol)" />
          <Slider label="Rate $\Rate{r}$" value={r} min={-0.02} max={0.15} step={0.005} onChange={setR} format={(x) => `${(x * 100).toFixed(1)}%`} color="var(--c-rate)" />
          <Slider label="Dividend yield $q$" value={q} min={0} max={0.1} step={0.005} onChange={setQ} format={(x) => `${(x * 100).toFixed(1)}%`} color="var(--text-muted)" />
        </>
      }
      readout={
        <dl className="readout-grid">
          <dt>Price</dt><dd style={{ color: `var(${color})` }}>{money(v)}</dd>
          <dt>Intrinsic / time value</dt><dd>{money(iv)} / {money(v - iv)} <span className="muted">({moneyness(type, S, K)})</span></dd>
          <dt>d₁, d₂ · N(d₁), N(d₂)</dt><dd>{d1.toFixed(3)}, {d2.toFixed(3)} · {cdf(d1).toFixed(3)}, {cdf(d2).toFixed(3)}</dd>
          {g && (
            <>
              <dt>Delta Δ · Gamma Γ</dt><dd>{g.delta.toFixed(3)} · {g.gamma.toFixed(4)}</dd>
              <dt>Vega (per vol point) · Theta (per day)</dt><dd>{money(g.vega / 100)} · {money(g.theta / 365)}{g.theta < 0 ? ' lost' : ' gained'}</dd>
            </>
          )}
        </dl>
      }
      caption="Colour map: the option's price for every stock price (across) and time to expiry (up). The crosshair marks the current inputs; hover anywhere to read a price."
    />
  );
}
