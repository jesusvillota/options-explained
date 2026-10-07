import { Polygon, Polyline } from 'mafs';
import { useMemo, useState } from 'react';
import { lognormalPdf } from '../../lib/math/lognormal';
import { price } from '../../lib/pricing/blackScholes';
import { girsanovWeight, marketPriceOfRisk, priceFromRealWorld, realWorldSamples } from '../../lib/theory/measure';
import { Segmented, Slider } from '../ui/controls';
import { WidgetFrame } from '../ui/WidgetFrame';
import { useTweened } from './animation';
import { money } from './format';
import { Label, PlotFrame } from './PlotFrame';

type View = 'P' | 'Q';
const S0 = 100, r = 0.05, sigma = 0.2, T = 1, K = 100;
const N = 20000;
const X0 = 40, X1 = 220, BINS = 45;

/**
 * Chapter 40: simulate the stock under the real-world measure P (drift μ),
 * then reweight each outcome by the Girsanov density dQ/dP. The histogram
 * morphs from the real-world distribution to the risk-neutral one, and the
 * weighted average of the payoff becomes the Black–Scholes price.
 */
export default function MeasureChange() {
  const [mu, setMu] = useState(0.15);
  const [view, setView] = useState<View>('P');
  const t = useTweened(view === 'Q' ? 1 : 0, 700);
  const input = { S: S0, mu, r, sigma, T };
  const samples = useMemo(() => realWorldSamples({ S: S0, mu, r, sigma, T }, N, 21), [mu]);
  const w = (X1 - X0) / BINS;
  const { pBins, qBins } = useMemo(() => {
    const p = new Array<number>(BINS).fill(0), q = new Array<number>(BINS).fill(0);
    for (const s of samples) {
      const b = Math.floor((s.ST - X0) / w);
      if (b < 0 || b >= BINS) continue;
      p[b] += 1;
      q[b] += s.weight;
    }
    return { pBins: p.map((c) => c / (N * w)), qBins: q.map((c) => c / (N * w)) };
  }, [samples, w]);
  const heights = pBins.map((p, i) => (1 - t) * p + t * qBins[i]);
  const xs = Array.from({ length: 181 }, (_, i) => X0 + i);
  const pCurve = xs.map((x) => [x, lognormalPdf(x, { S0, mu, sigma, T })] as [number, number]);
  const qCurve = xs.map((x) => [x, lognormalPdf(x, { S0, mu: r, sigma, T })] as [number, number]);
  const yMax = Math.max(...pCurve.map(([, y]) => y), ...qCurve.map(([, y]) => y)) * 1.25;
  const theta = marketPriceOfRisk(input);
  // The weight as a function of the outcome: W_T = (ln(S_T/S₀) − (μ − ½σ²)T)/σ.
  const weightAt = (ST: number) => girsanovWeight((Math.log(ST / S0) - (mu - 0.5 * sigma * sigma) * T) / sigma, theta, T);
  const wMax = 3; // weights in the far tail are larger; the curve is clipped at 3
  const call = (ST: number) => Math.max(ST - K, 0);
  const naive = priceFromRealWorld(samples, call, r, T, false);
  const weighted = priceFromRealWorld(samples, call, r, T, true);
  const bs = price('call', { S: S0, K, T, r, sigma });

  const hist = (
    <PlotFrame x={[X0, X1]} y={[0, yMax]} height={210} xTicks={[50, 100, 150, 200]} yTicks={[]} formatX={(v) => `$${v}`} yLabel={view === 'Q' ? 'reweighted: risk-neutral' : 'simulated: real world'}>
      {heights.map((h, i) => (
        <Polygon key={i} points={[[X0 + i * w, 0], [X0 + (i + 1) * w, 0], [X0 + (i + 1) * w, h], [X0 + i * w, h]]} color="var(--c-prob)" fillOpacity={0.35} strokeOpacity={0.5} weight={0.5} />
      ))}
      <Polyline points={pCurve} color="var(--c-spot)" weight={2} strokeStyle="dashed" fillOpacity={0} />
      <Polyline points={qCurve} color="var(--c-call)" weight={2} fillOpacity={0} />
      <Label x={180} y={lognormalPdf(180, { S0, mu, sigma, T })} attach="ne" attachDistance={6} size={12} color="var(--c-spot)">P: drift μ</Label>
      <Label x={60} y={lognormalPdf(60, { S0, mu: r, sigma, T })} attach="ne" attachDistance={6} size={12} color="var(--c-call)">Q: drift r</Label>
    </PlotFrame>
  );
  const weights = (
    <div style={{ borderTop: '1px solid var(--border)' }}>
      <PlotFrame x={[X0, X1]} y={[0, wMax]} height={130} xTicks={[50, 100, 150, 200]} yTicks={[0, 1, 2, 3]} formatX={(v) => `$${v}`} formatY={(v) => String(v)} baseline={1} xLabel="stock price in a year" yLabel="weight dQ/dP">
        <Polyline points={xs.map((x) => [x, Math.min(weightAt(x), wMax)] as [number, number])} color="var(--c-vol)" weight={2.5} fillOpacity={0} />
      </PlotFrame>
    </div>
  );

  return (
    <WidgetFrame
      title="Changing the measure"
      ariaLabel={`${N} outcomes simulated with real-world drift ${Math.round(mu * 100)}%. Average discounted call payoff ${money(naive)} unweighted, ${money(weighted)} with Girsanov weights; Black–Scholes ${money(bs)}.`}
      plotHeight={340}
      plot={<>{hist}{weights}</>}
      controls={
        <>
          <Segmented label="Histogram" value={view} onChange={setView} options={[
            { value: 'P', label: 'Real world (P)' },
            { value: 'Q', label: 'Reweighted (Q)' },
          ]} />
          <Slider label="Real-world drift μ" value={mu} min={-0.1} max={0.3} step={0.01} onChange={setMu} format={(v) => `${Math.round(v * 100)}%`} color="var(--c-spot)" />
        </>
      }
      readout={
        <dl className="readout-grid">
          <dt>Market price of risk θ</dt><dd>{theta.toFixed(2)} <span className="muted">= (μ − r)/σ</span></dd>
          <dt>Call, average under P</dt><dd className={Math.abs(naive - bs) > 0.3 ? 'bad' : ''}>{money(naive)} <span className="muted">(wrong unless μ = r)</span></dd>
          <dt>Call, weighted by dQ/dP</dt><dd className="good">{money(weighted)} <span className="muted">Black–Scholes {money(bs)}</span></dd>
        </dl>
      }
      caption="One-year at-the-money call, $\Vol{\sigma} = 20\%$, $\Rate{r} = 5\%$. Bars: 20,000 outcomes simulated with drift μ. Toggle to reweight them by $Z = e^{-\theta W_T - \frac12\theta^2 T}$ (bottom curve): the same outcomes, with the risk-neutral probabilities."
    />
  );
}
