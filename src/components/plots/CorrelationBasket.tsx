import { Line, Point, Polyline } from 'mafs';
import { useMemo, useState } from 'react';
import { normalRng } from '../../lib/math/rng';
import { margrabe, twoAssetMC } from '../../lib/pricing/exotics';
import { Slider } from '../ui/controls';
import { WidgetFrame } from '../ui/WidgetFrame';
import { money } from './format';
import { Label, PlotFrame } from './PlotFrame';

const T = 1, r = 0.05, S0 = 100;
const DOTS = 300;
const RHOS = Array.from({ length: 21 }, (_, i) => -1 + i * 0.1);

/**
 * Chapter 39: two stocks with correlation ρ. Top: simulated year-end prices of
 * both, one dot per scenario. Bottom: how two prices depend on ρ, a basket
 * call on the average (up with ρ) and the option to exchange one stock for the
 * other (down with ρ, Margrabe's formula).
 */
export default function CorrelationBasket() {
  const [rho, setRho] = useState(0.3);
  const [sigma, setSigma] = useState(0.25);
  const dots = useMemo(() => {
    const z = normalRng(17);
    const m = (r - 0.5 * sigma * sigma) * T, s = sigma * Math.sqrt(T);
    return Array.from({ length: DOTS }, () => {
      const z1 = z(), z2 = rho * z1 + Math.sqrt(1 - rho * rho) * z();
      return [S0 * Math.exp(m + s * z1), S0 * Math.exp(m + s * z2)] as [number, number];
    });
  }, [rho, sigma]);
  const basketCurve = useMemo(
    () => RHOS.map((p) => [p, twoAssetMC((a, b) => Math.max(0.5 * (a + b) - 100, 0), { S1: S0, S2: S0, sigma1: sigma, sigma2: sigma, rho: Math.max(Math.min(p, 0.9999), -0.9999), T, r }, 20000, 5).price] as [number, number]),
    [sigma],
  );
  const exchangeCurve = RHOS.map((p) => [p, margrabe(S0, S0, T, sigma, sigma, p)] as [number, number]);
  const basket = twoAssetMC((a, b) => Math.max(0.5 * (a + b) - 100, 0), { S1: S0, S2: S0, sigma1: sigma, sigma2: sigma, rho, T, r }, 40000, 5);
  const exchange = margrabe(S0, S0, T, sigma, sigma, rho);
  const basketVol = sigma * Math.sqrt((1 + rho) / 2);
  const yMax = Math.max(...basketCurve.map(([, v]) => v), ...exchangeCurve.map(([, v]) => v)) * 1.1;

  const scatter = (
    <PlotFrame x={[30, 220]} y={[30, 220]} height={230} xTicks={[50, 100, 150, 200]} yTicks={[50, 100, 150, 200]} formatX={(v) => `$${v}`} formatY={(v) => `$${v}`} xLabel="stock 1 in a year" yLabel="stock 2">
      {dots.map(([a, b], i) => <Point key={i} x={Math.min(a, 220)} y={Math.min(b, 220)} color="var(--c-spot)" opacity={0.45} svgCircleProps={{ r: 2.5 }} />)}
      <Line.Segment point1={[30, 30]} point2={[220, 220]} color="var(--text-muted)" style="dashed" weight={1} />
    </PlotFrame>
  );
  const prices = (
    <div style={{ borderTop: '1px solid var(--border)' }}>
      <PlotFrame x={[-1, 1]} y={[0, yMax]} height={170} xTicks={[-1, -0.5, 0, 0.5, 1]} yTicks={[0, 5, 10, 15]} formatX={(v) => `ρ = ${v}`} formatY={(v) => money(v, 0)} yLabel="option price">
        <Polyline points={basketCurve} color="var(--c-call)" weight={2.5} fillOpacity={0} />
        <Polyline points={exchangeCurve} color="var(--c-vol)" weight={2.5} fillOpacity={0} />
        <Line.Segment point1={[rho, 0]} point2={[rho, yMax]} color="var(--c-strike)" style="dashed" weight={1} />
        <Point x={rho} y={basket.price} color="var(--c-call)" />
        <Point x={rho} y={exchange} color="var(--c-vol)" />
        <Label x={0.98} y={basketCurve[20][1]} attach="nw" attachDistance={6} size={12} color="var(--c-call)">basket call</Label>
        <Label x={-0.5} y={exchangeCurve[5][1]} attach="ne" attachDistance={6} size={12} color="var(--c-vol)">exchange option</Label>
      </PlotFrame>
    </div>
  );

  return (
    <WidgetFrame
      title="Correlation decides"
      ariaLabel={`Two stocks with correlation ${rho.toFixed(2)}: basket call on the average ${money(basket.price)}, option to exchange one for the other ${money(exchange)}.`}
      plotHeight={400}
      plot={<>{scatter}{prices}</>}
      controls={
        <>
          <Slider label="Correlation ρ" value={rho} min={-0.95} max={0.95} step={0.05} onChange={setRho} format={(v) => v.toFixed(2)} color="var(--c-strike)" />
          <Slider label="Volatility of each stock" value={sigma} min={0.1} max={0.5} step={0.01} onChange={setSigma} format={(v) => `${Math.round(v * 100)}%`} color="var(--c-vol)" />
        </>
      }
      readout={
        <dl className="readout-grid">
          <dt>Basket call on the average, K = $100</dt><dd>{money(basket.price)} <span className="muted">± {money(2 * basket.stdError)} (Monte Carlo); basket vol ≈ {Math.round(basketVol * 100)}%</span></dd>
          <dt>Exchange stock 2 for stock 1</dt><dd>{money(exchange)} <span className="muted">(Margrabe; vol of the ratio {Math.round(sigma * Math.sqrt(2 - 2 * rho) * 100)}%)</span></dd>
        </dl>
      }
      caption="Both stocks start at \$100 with the same volatility; one year, $\Rate{r} = 5\%$. Top: 300 simulated year-end pairs. Bottom: the two prices for every correlation (the dots mark the slider's value)."
    />
  );
}
