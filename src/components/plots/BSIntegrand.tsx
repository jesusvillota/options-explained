import { Line, Polygon, Polyline } from 'mafs';
import { useState } from 'react';
import { lognormalPdf } from '../../lib/math/lognormal';
import { cdf } from '../../lib/math/normal';
import { d1d2, DEFAULTS, price } from '../../lib/pricing/blackScholes';
import { Segmented, Slider } from '../ui/controls';
import { Tex } from '../ui/Tex';
import { WidgetFrame } from '../ui/WidgetFrame';
import { money, niceTicks } from './format';
import { Label, PlotFrame, Sub } from './PlotFrame';

type Measure = 'Q' | 'share';

/**
 * Chapter 18: the Black–Scholes call price as an area. Top: the risk-neutral
 * density of S_T; the shaded tail beyond K has area N(d2) (or N(d1) under the
 * share measure). Bottom: the integrand (S_T − K)·f(S_T); its area is e^{rT} C.
 */
export default function BSIntegrand() {
  const [S, setS] = useState(100);
  const [K, setK] = useState(110);
  const [sigma, setSigma] = useState(0.2);
  const [T, setT] = useState(1);
  const [r, setR] = useState(0.05);
  const [measure, setMeasure] = useState<Measure>('Q');
  const input = { ...DEFAULTS, S, K, sigma, T, r };
  const { d1, d2 } = d1d2(input);
  const C = price('call', input);
  const xMax = Math.max(S * Math.exp(r * T + 3.2 * sigma * Math.sqrt(T)), K * 1.3);
  const xs = Array.from({ length: 241 }, (_, i) => (i * xMax) / 240);
  const drift = measure === 'Q' ? r : r + sigma * sigma;
  const f = (x: number) => lognormalPdf(x, { S0: S, mu: drift, sigma, T });
  const fQ = (x: number) => lognormalPdf(x, { S0: S, mu: r, sigma, T });
  const dens = xs.map((x) => [x, f(x)] as [number, number]);
  const tail = [[K, 0] as [number, number], ...xs.filter((x) => x >= K).map((x) => [x, f(x)] as [number, number]), [xMax, 0] as [number, number]];
  const fMax = Math.max(...dens.map((d) => d[1])) * 1.15;
  const integrand = xs.map((x) => [x, Math.max(x - K, 0) * fQ(x)] as [number, number]);
  const iMax = Math.max(...integrand.map((d) => d[1]), 1e-6) * 1.2;
  const prob = measure === 'Q' ? cdf(d2) : cdf(d1);
  const xTicks = niceTicks(0, xMax, 5);

  const top = (
    <PlotFrame x={[0, xMax]} y={[0, fMax]} height={210} xTicks={xTicks} yTicks={[]} formatX={(v) => `$${v}`} yLabel={measure === 'Q' ? 'risk-neutral density of S_T' : 'density under the share measure'}>
      <Polygon points={tail} color="var(--c-call)" fillOpacity={0.25} strokeOpacity={0} weight={0} />
      <Polyline points={dens} color="var(--c-prob)" weight={2.5} fillOpacity={0} />
      <Line.Segment point1={[K, 0]} point2={[K, fMax]} color="var(--c-strike)" style="dashed" weight={2} />
      <Label x={K} y={fMax * 0.9} attach="e" attachDistance={8} size={12} color="var(--c-call)">
        shaded area = {measure === 'Q' ? 'N(d₂)' : 'N(d₁)'} = {(prob * 100).toFixed(1)}%
      </Label>
    </PlotFrame>
  );
  const bottom = (
    <div style={{ borderTop: '1px solid var(--border)' }}>
      <PlotFrame x={[0, xMax]} y={[0, iMax]} height={190} xTicks={xTicks} yTicks={[]} formatX={(v) => `$${v}`} xLabel={<>stock price at expiry <Sub base="S" sub="T" /></>} yLabel="payoff × density">
        <Polygon points={[[K, 0], ...integrand.filter((p) => p[0] >= K), [xMax, 0]] as [number, number][]} color="var(--c-call)" fillOpacity={0.35} strokeOpacity={0} weight={0} />
        <Polyline points={integrand} color="var(--c-call)" weight={2.5} fillOpacity={0} />
        <Line.Segment point1={[K, 0]} point2={[K, iMax]} color="var(--c-strike)" style="dashed" weight={2} />
        <Label x={K} y={iMax * 0.85} attach="e" attachDistance={8} size={12} color="var(--c-call)">
          area = e^(rT) × C = {money(C * Math.exp(r * T))}
        </Label>
      </PlotFrame>
    </div>
  );

  return (
    <WidgetFrame
      title="Black–Scholes as an area"
      ariaLabel={`Call with S = ${S}, K = ${K}: N(d1) = ${cdf(d1).toFixed(3)}, N(d2) = ${cdf(d2).toFixed(3)}, price ${money(C)}.`}
      plotHeight={400}
      plot={<>{top}{bottom}</>}
      controls={
        <>
          <Segmented label="Probability" value={measure} onChange={setMeasure} options={[
            { value: 'Q', label: 'Risk-neutral ℚ' },
            { value: 'share', label: 'Share measure' },
          ]} />
          <Slider label="Stock price $\Spot{S}$" value={S} min={50} max={150} onChange={setS} format={(v) => `$${v}`} color="var(--c-spot)" />
          <Slider label="Strike $\Strike{K}$" value={K} min={50} max={150} onChange={setK} format={(v) => `$${v}`} color="var(--c-strike)" />
          <Slider label="Volatility $\Vol{\sigma}$" value={sigma} min={0.05} max={0.8} step={0.01} onChange={setSigma} format={(v) => `${Math.round(v * 100)}%`} color="var(--c-vol)" />
          <Slider label="Time $\Time{T}$" value={T} min={0.05} max={3} step={0.05} onChange={setT} format={(v) => `${v.toFixed(2)} yr`} color="var(--c-time)" />
          <Slider label="Rate $\Rate{r}$" value={r} min={0} max={0.12} step={0.005} onChange={setR} format={(v) => `${(v * 100).toFixed(1)}%`} color="var(--c-rate)" />
        </>
      }
      readout={
        <>
          <dl className="readout-grid">
            <dt>d₁, d₂</dt><dd>{d1.toFixed(4)}, {d2.toFixed(4)}</dd>
            <dt>N(d₁), N(d₂)</dt><dd>{cdf(d1).toFixed(4)}, {cdf(d2).toFixed(4)}</dd>
            <dt>S·N(d₁)</dt><dd>{money(S * cdf(d1))}</dd>
            <dt>K e^(−rT)·N(d₂)</dt><dd>{money(K * Math.exp(-r * T) * cdf(d2))}</dd>
            <dt>Call price</dt><dd style={{ color: 'var(--c-call)' }}>{money(C)}</dd>
          </dl>
          <p style={{ marginTop: '0.5rem' }}><Tex>{'\\Call{C} = \\Spot{S}\\,N(d_1) - \\Strike{K}e^{-\\Rate{r}\\Time{T}}N(d_2)'}</Tex></p>
        </>
      }
      caption="Top: the probability density of the stock price at expiry. The shaded tail is the chance of finishing in the money. Bottom: payoff times density; its area is the expected payoff, which discounted is the price."
    />
  );
}
