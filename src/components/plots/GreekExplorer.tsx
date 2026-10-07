import { useState } from 'react';
import { DEFAULTS, greeks, secondOrderGreeks } from '../../lib/pricing/blackScholes';
import type { OptionType } from '../../lib/pricing/payoff';
import { Segmented, Slider } from '../ui/controls';
import { WidgetFrame } from '../ui/WidgetFrame';
import { Heatmap } from './Heatmap';

type GreekName = 'delta' | 'gamma' | 'vega' | 'theta' | 'rho' | 'vanna' | 'volga' | 'charm';
const META: Record<GreekName, { label: string; unit: string; scale: number; what: string }> = {
  delta: { label: 'Delta Δ', unit: '', scale: 1, what: 'change in price per $1 move in the stock' },
  gamma: { label: 'Gamma Γ', unit: '', scale: 1, what: 'change in delta per $1 move' },
  vega: { label: 'Vega', unit: '$ per vol point', scale: 0.01, what: 'change in price per 1 point of volatility' },
  theta: { label: 'Theta Θ', unit: '$ per day', scale: 1 / 365, what: 'change in price per day that passes' },
  rho: { label: 'Rho ρ', unit: '$ per 1% rate', scale: 0.01, what: 'change in price per 1 point of interest rate' },
  vanna: { label: 'Vanna', unit: 'Δ per vol point', scale: 0.01, what: 'change in delta per 1 point of volatility' },
  volga: { label: 'Volga', unit: 'vega per vol point', scale: 0.0001, what: 'change in vega per 1 point of volatility' },
  charm: { label: 'Charm', unit: 'Δ per day', scale: 1 / 365, what: 'change in delta per day that passes' },
};

function value(name: GreekName, type: OptionType, S: number, T: number, sigma: number): number {
  const input = { ...DEFAULTS, S, T, sigma };
  if (name === 'vanna' || name === 'volga' || name === 'charm') return secondOrderGreeks(type, input)[name] * META[name].scale;
  return greeks(type, input)[name] * META[name].scale;
}

/**
 * Chapter 23: any Greek as a colour map over stock price and time to expiry.
 * Positive values in the option's colour, negative in the other.
 */
export default function GreekExplorer() {
  const [name, setName] = useState<GreekName>('vega');
  const [type, setType] = useState<OptionType>('call');
  const [sigma, setSigma] = useState(0.2);
  const [S, setS] = useState(100);
  const [T, setT] = useState(0.5);
  const v = value(name, type, S, T, sigma);
  const fmt = (x: number) => (Math.abs(x) >= 1 ? x.toFixed(2) : x.toPrecision(3));

  return (
    <WidgetFrame
      title="Greek explorer"
      ariaLabel={`${META[name].label} of a ${type} over stock price and time to expiry; at S = ${S}, τ = ${T}: ${fmt(v)}.`}
      plotHeight={320}
      plot={
        <Heatmap
          f={(s, t) => value(name, type, s, t, sigma)}
          x={[50, 150]}
          y={[0.02, 2]}
          height={320}
          color={type === 'call' ? '--c-call' : '--c-put'}
          negativeColor={type === 'call' ? '--c-put' : '--c-call'}
          xTicks={[50, 75, 100, 125, 150]}
          yTicks={[0.5, 1, 1.5, 2]}
          formatX={(s) => `$${Math.round(s)}`}
          formatY={(t) => `${t.toFixed(1)} yr`}
          formatValue={fmt}
          xLabel="stock price S (strike $100)"
          yLabel={`${META[name].label} ${META[name].unit ? `(${META[name].unit})` : ''}`}
          marker={[S, T]}
          nx={100}
          ny={70}
        />
      }
      controls={
        <>
          <Segmented label="Greek" value={name} onChange={setName} options={(Object.keys(META) as GreekName[]).map((k) => ({ value: k, label: META[k].label.split(' ')[0] }))} />
          <Segmented label="Option type" value={type} onChange={setType} options={[
            { value: 'call', label: 'Call', color: 'var(--c-call)' },
            { value: 'put', label: 'Put', color: 'var(--c-put)' },
          ]} />
          <Slider label="Stock $\Spot{S}$" value={S} min={50} max={150} onChange={setS} format={(x) => `$${x}`} color="var(--c-spot)" />
          <Slider label="Time to expiry $\Time{\tau}$" value={T} min={0.02} max={2} step={0.02} onChange={setT} format={(x) => `${x.toFixed(2)} yr`} color="var(--c-time)" />
          <Slider label="Volatility $\Vol{\sigma}$" value={sigma} min={0.05} max={0.8} step={0.01} onChange={setSigma} format={(x) => `${Math.round(x * 100)}%`} color="var(--c-vol)" />
        </>
      }
      readout={
        <p>
          <strong>{META[name].label}</strong> = <strong className="num">{fmt(v)}</strong> {META[name].unit}: the {META[name].what}.
        </p>
      }
      caption="Colour = the Greek's value for every stock price (across) and time to expiry (up); strike \$100. Two colours for two signs. The crosshair marks the sliders' position."
    />
  );
}
