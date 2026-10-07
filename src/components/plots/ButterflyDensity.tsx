import { Polygon, Polyline } from 'mafs';
import { useState } from 'react';
import { lognormalPdf } from '../../lib/math/lognormal';
import { DEFAULTS, price } from '../../lib/pricing/blackScholes';
import { butterflyDensity } from '../../lib/vol/density';
import { Segmented, Slider } from '../ui/controls';
import { WidgetFrame } from '../ui/WidgetFrame';
import { money } from './format';
import { Label, PlotFrame } from './PlotFrame';

type Width = '20' | '10' | '5' | '2';
const { r, T, sigma, S } = DEFAULTS;
const K_MIN = 40, K_MAX = 200;
const HEIGHT = 300;
const call = (K: number) => price('call', { ...DEFAULTS, K });
const density = (x: number) => lognormalPdf(x, { S0: S, mu: r, sigma, T });

/**
 * Chapter 27: butterflies of width h at every strike, each priced from call
 * prices and scaled by e^{rT}/h². The bars are the market's probability per
 * dollar of ending near each strike; as h shrinks they trace the density.
 */
export default function ButterflyDensity() {
  const [width, setWidth] = useState<Width>('10');
  const [centre, setCentre] = useState(110);
  const h = Number(width);
  const strikes = Array.from({ length: Math.floor((K_MAX - K_MIN) / h) - 1 }, (_, i) => K_MIN + h * (i + 1));
  const bars = strikes.map((K) => ({ K, v: butterflyDensity(call, K, h, r, T) }));
  const yMax = 0.024;
  const Kc = Math.round(centre / h) * h;
  const fly = call(Kc - h) - 2 * call(Kc) + call(Kc + h);
  const est = butterflyDensity(call, Kc, h, r, T);
  const curve = Array.from({ length: 161 }, (_, i) => [K_MIN + i, density(K_MIN + i)] as [number, number]);

  return (
    <WidgetFrame
      title="Butterflies trace the density"
      ariaLabel={`Butterflies of width ${h} dollars. The one centred at ${Kc} costs ${money(fly)}, implying a density of ${est.toFixed(4)} against ${density(Kc).toFixed(4)} for the lognormal.`}
      plotHeight={HEIGHT}
      plot={
        <PlotFrame x={[K_MIN, K_MAX]} y={[0, yMax]} height={HEIGHT} xTicks={[40, 60, 80, 100, 120, 140, 160, 180, 200]} yTicks={[0, 0.01, 0.02]} formatX={(v) => `$${v}`} formatY={(v) => v.toFixed(2)} xLabel="strike K = stock price at expiry" yLabel="probability per $1" marginLeft={52}>
          {bars.map(({ K, v }) => (
            <Polygon key={K} points={[[K - h / 2, 0], [K + h / 2, 0], [K + h / 2, v], [K - h / 2, v]]} color={K === Kc ? 'var(--c-call)' : 'var(--c-strike)'} fillOpacity={K === Kc ? 0.7 : 0.35} strokeOpacity={0.6} weight={h >= 5 ? 1 : 0.5} />
          ))}
          <Polyline points={curve} color="var(--c-prob)" weight={2.5} fillOpacity={0} />
          <Label x={150} y={density(150)} attach="ne" attachDistance={6} size={12} color="var(--c-prob)">lognormal density</Label>
        </PlotFrame>
      }
      controls={
        <>
          <Segmented label="Butterfly width h" value={width} onChange={setWidth} options={[
            { value: '20', label: '$20' },
            { value: '10', label: '$10' },
            { value: '5', label: '$5' },
            { value: '2', label: '$2' },
          ]} />
          <Slider label="Highlighted butterfly" value={centre} min={60} max={180} step={1} onChange={setCentre} format={() => `${Kc - h} / ${Kc} / ${Kc + h}`} color="var(--c-call)" />
        </>
      }
      readout={
        <dl className="readout-grid">
          <dt>Butterfly cost</dt><dd>{money(fly, 4)} <span className="muted">= C({Kc - h}) − 2C({Kc}) + C({Kc + h})</span></dd>
          <dt>× e^(rT)/h²</dt><dd>{est.toFixed(5)} <span className="muted">(true density {density(Kc).toFixed(5)})</span></dd>
        </dl>
      }
      caption="Black–Scholes call prices with $\Vol{\sigma} = 20\%$, one year, $\Rate{r} = 5\%$. Each bar is one butterfly's price scaled by $e^{\Rate{r}\Time{T}}/h^2$. Its area is the risk-neutral probability of ending within about $h/2$ of its strike."
    />
  );
}
