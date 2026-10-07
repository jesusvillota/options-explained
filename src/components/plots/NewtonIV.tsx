import { Line, Point, Polygon, Polyline } from 'mafs';
import { Fragment, useEffect, useState } from 'react';
import { price } from '../../lib/pricing/blackScholes';
import { bisectionBrackets, newtonIterates, type MarketInput } from '../../lib/vol/impliedVol';
import { Button, Segmented, Slider } from '../ui/controls';
import { WidgetFrame } from '../ui/WidgetFrame';
import { usePrefersReducedMotion } from './animation';
import { clamp, money, niceTicks } from './format';
import { Label, PlotFrame } from './PlotFrame';

type Method = 'newton' | 'bisection';
const SIGMA_MAX = 1;
const MAX_STEPS = 8;
const HEIGHT = 320;

/**
 * Chapter 25: back out the implied volatility of a call from its price.
 * Newton slides down tangent lines of C(σ) (slope = vega) to the market price;
 * bisection halves a bracket. Step through either and compare.
 */
export default function NewtonIV() {
  const [K, setK] = useState(130);
  const [quote, setQuote] = useState(4);
  const [sigma0, setSigma0] = useState(0.6);
  const [method, setMethod] = useState<Method>('newton');
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const reduced = usePrefersReducedMotion();

  const market: MarketInput = { S: 100, K, T: 1, r: 0.05 };
  const C = (s: number) => price('call', { ...market, sigma: Math.max(s, 1e-6) });
  // Keep the quote strictly inside the range Black–Scholes can produce on the plotted σ range.
  const lo = C(0.02) + 0.01, hi = C(0.95);
  const target = clamp(quote, lo, hi);
  const iterates = newtonIterates('call', target, market, sigma0, MAX_STEPS);
  const brackets = bisectionBrackets('call', target, market, 0.01, SIGMA_MAX, MAX_STEPS);
  const lastStep = method === 'newton' ? iterates.length - 1 : brackets.length - 1;
  const shown = Math.min(step, lastStep);

  // Any change of inputs restarts the iteration.
  useEffect(() => { setStep(0); setPlaying(false); }, [K, quote, sigma0, method]);
  useEffect(() => {
    if (!playing) return;
    if (reduced) { setStep(lastStep); setPlaying(false); return; }
    if (step >= lastStep) { setPlaying(false); return; }
    const id = setTimeout(() => setStep((s) => s + 1), 800);
    return () => clearTimeout(id);
  }, [playing, step, lastStep, reduced]);

  const yMax = C(SIGMA_MAX) * 1.08;
  const curve = Array.from({ length: 121 }, (_, i) => [(i / 120) * SIGMA_MAX, C((i / 120) * SIGMA_MAX)] as [number, number]);
  const inPlot = (s: number) => s >= 0 && s <= SIGMA_MAX;
  const current = method === 'newton' ? iterates[shown] : 0.5 * (brackets[shown][0] + brackets[shown][1]);
  const escaped = method === 'newton' && !inPlot(iterates[shown]);

  const newtonMarks = iterates.slice(0, shown + 1).map((s, n) => {
    const next = iterates[n + 1];
    const drawTangent = n < shown && inPlot(s) && Math.abs(next - s) > 1e-12;
    return (
      <Fragment key={n}>
        {inPlot(s) && <Point x={s} y={C(s)} color="var(--c-vol)" />}
        {drawTangent && (
          <Line.Segment point1={[s, C(s)]} point2={[clamp(next, -0.05, SIGMA_MAX + 0.05), C(s) + (clamp(next, -0.05, SIGMA_MAX + 0.05) - s) * ((target - C(s)) / (next - s))]} color="var(--c-vol)" weight={2.5} />
        )}
        {drawTangent && inPlot(next) && <Line.Segment point1={[next, target]} point2={[next, C(next)]} color="var(--c-vol)" style="dashed" weight={1.2} />}
        {inPlot(s) && n <= 2 && (n === 0 || Math.abs(s - iterates[n - 1]) > 0.04) && <Label x={s} y={0} attach="n" attachDistance={4} size={11} color="var(--c-vol)">σ{subscript(n)}</Label>}
      </Fragment>
    );
  });

  const [a, b] = brackets[shown];
  const bisectionMarks = (
    <>
      <Polygon points={[[a, 0], [b, 0], [b, yMax], [a, yMax]]} color="var(--c-vol)" fillOpacity={0.12} strokeOpacity={0} />
      <Line.Segment point1={[a, 0]} point2={[a, yMax]} color="var(--c-vol)" weight={1.2} />
      <Line.Segment point1={[b, 0]} point2={[b, yMax]} color="var(--c-vol)" weight={1.2} />
      <Point x={0.5 * (a + b)} y={C(0.5 * (a + b))} color="var(--c-vol)" />
    </>
  );

  const plot = (
    <PlotFrame x={[0, SIGMA_MAX]} y={[0, yMax]} height={HEIGHT} xTicks={[0, 0.2, 0.4, 0.6, 0.8, 1]} yTicks={niceTicks(0, yMax, 4)} formatX={(v) => `${Math.round(v * 100)}%`} formatY={(v) => money(v, 0)} xLabel="volatility σ" yLabel="call price C(σ)">
      {method === 'bisection' && bisectionMarks}
      <Line.Segment point1={[0, target]} point2={[SIGMA_MAX, target]} color="var(--c-strike)" style="dashed" weight={1.5} />
      <Label x={0.01} y={target} attach="ne" attachDistance={4} size={12} color="var(--c-strike)">market price {money(target)}</Label>
      <Polyline points={curve} color="var(--c-call)" weight={3} fillOpacity={0} />
      {method === 'newton' && newtonMarks}
    </PlotFrame>
  );

  const rows = method === 'newton'
    ? iterates.slice(0, shown + 1).map((s, n) => ({ n, s, err: s > 0 ? C(s) - target : NaN }))
    : brackets.slice(0, shown + 1).map(([x, y], n) => ({ n, s: 0.5 * (x + y), err: C(0.5 * (x + y)) - target }));

  return (
    <WidgetFrame
      title="Backing out implied volatility"
      ariaLabel={`Call struck at ${K} quoted at ${money(target)}. ${method === 'newton' ? 'Newton' : 'Bisection'} step ${shown}: σ = ${(current * 100).toFixed(2)}%.`}
      plotHeight={HEIGHT}
      plot={plot}
      controls={
        <>
          <Segmented label="Method" value={method} onChange={setMethod} options={[
            { value: 'newton', label: 'Newton' },
            { value: 'bisection', label: 'Bisection' },
          ]} />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button onClick={() => setStep((s) => Math.min(s + 1, lastStep))} disabled={shown >= lastStep}>Step</Button>
            <Button onClick={() => { setStep(0); setPlaying(true); }}>Play</Button>
            <Button onClick={() => { setStep(0); setPlaying(false); }}>Reset</Button>
          </div>
          <Slider label="Market price of the call" value={quote} min={0.5} max={40} step={0.25} onChange={setQuote} format={(v) => money(clamp(v, lo, hi))} color="var(--c-strike)" />
          <Slider label="Strike $\Strike{K}$" value={K} min={70} max={150} step={5} onChange={setK} format={(v) => money(v, 0)} color="var(--c-strike)" />
          {method === 'newton' && <Slider label="Starting guess $\Vol{\sigma}_0$" value={sigma0} min={0.05} max={1} step={0.05} onChange={setSigma0} format={(v) => `${Math.round(v * 100)}%`} color="var(--c-vol)" />}
        </>
      }
      readout={
        <>
          <table className="iter-table">
            <thead><tr><th>step</th><th>σ</th><th>C(σ) − market</th></tr></thead>
            <tbody>
              {rows.slice(-5).map(({ n, s, err }) => (
                <tr key={n}><td>{n}</td><td>{pct(s)}</td><td>{Number.isFinite(err) ? err.toExponential(2) : '—'}</td></tr>
              ))}
            </tbody>
          </table>
          {escaped && <p className="bad">Newton jumped out of range (σ = {pct(iterates[shown])}). A robust solver now falls back to bisection.</p>}
        </>
      }
      caption="S = \$100, one year, r = 5%. Newton follows the tangent, whose slope is vega, to where it meets the market price. Bisection keeps a bracket that must contain the answer and halves it."
    />
  );
}

const pct = (s: number) => (Math.abs(s) > 10 ? `${s < 0 ? '−' : ''}${(Math.abs(s) * 100).toExponential(1)}%` : `${(s * 100).toFixed(4)}%`);
const SUBSCRIPTS = '₀₁₂₃₄₅₆₇₈₉';
const subscript = (n: number) => String(n).split('').map((d) => SUBSCRIPTS[Number(d)]).join('');
