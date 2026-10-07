import { Line, MovablePoint, Polyline } from 'mafs';
import { useState } from 'react';
import { DEFAULTS, price } from '../../lib/pricing/blackScholes';
import { butterflyProbabilities, shapeViolations, type StrikeQuote } from '../../lib/pricing/shape';
import { Button } from '../ui/controls';
import { WidgetFrame } from '../ui/WidgetFrame';
import { clamp, money } from './format';
import { Label, PlotFrame } from './PlotFrame';

const STRIKES = [70, 80, 90, 100, 110, 120, 130];
const X: [number, number] = [65, 135];
const fresh = (): StrikeQuote[] => STRIKES.map((K) => ({ K, C: Math.round(price('call', { ...DEFAULTS, K }) * 4) / 4 }));
const LABELS = { increasing: 'Price rises with the strike', 'too-steep': 'Price falls too steeply', 'not-convex': 'Curve bends the wrong way' };

/**
 * Chapter 10: drag call prices at seven strikes. The strip must fall, not too
 * steeply, and curve upwards (convex); otherwise a spread or butterfly is free
 * money. Below, butterflies turn the curvature into probabilities.
 */
export default function ConvexityEditor() {
  const [quotes, setQuotes] = useState<StrikeQuote[]>(fresh);
  const { r, T } = DEFAULTS;
  const violations = shapeViolations(quotes, r, T, 0.001);
  const probs = butterflyProbabilities(quotes, r, T);
  const badPairs = violations.filter((v) => v.strikes.length === 2);
  const badMiddles = new Set(violations.filter((v) => v.kind === 'not-convex').map((v) => v.strikes[1]));
  const smooth = Array.from({ length: 71 }, (_, i) => X[0] + i).map((K) => [K, price('call', { ...DEFAULTS, K })] as [number, number]);
  const set = (K: number, C: number) => setQuotes((qs) => qs.map((q) => (q.K === K ? { ...q, C } : q)));

  const plot = (
    <>
      <PlotFrame
        x={X}
        y={[-1, 36]}
        height={300}
        xTicks={STRIKES}
        yTicks={[0, 10, 20, 30]}
        formatX={(v) => `$${v}`}
        formatY={(v) => `$${v}`}
        baseline={0}
        xLabel="strike K"
        yLabel="call price"
      >
        <Polyline points={smooth} color="var(--c-call)" weight={1.5} strokeStyle="dashed" strokeOpacity={0.45} fillOpacity={0} />
        <Polyline points={quotes.map((q) => [q.K, q.C] as [number, number])} color="var(--c-call)" weight={3} fillOpacity={0} />
        {badPairs.map((v, i) => {
          const [a, b] = v.strikes.map((K) => quotes.find((q) => q.K === K)!);
          return <Line.Segment key={i} point1={[a.K, a.C]} point2={[b.K, b.C]} color="var(--c-put)" weight={6} opacity={0.8} />;
        })}
        {quotes.map((q) => (
          <MovablePoint
            key={q.K}
            point={[q.K, q.C]}
            color={badMiddles.has(q.K) ? 'var(--c-put)' : 'var(--c-call)'}
            onMove={([, y]) => set(q.K, Math.round(clamp(y, 0, 34) * 4) / 4)}
            constrain={([, y]) => [q.K, clamp(y, 0, 34)]}
          />
        ))}
      </PlotFrame>
      <div style={{ borderTop: '1px solid var(--border)' }}>
        <PlotFrame
          x={X}
          y={[-0.12, 0.42]}
          height={170}
          xTicks={STRIKES}
          yTicks={[0, 0.2, 0.4]}
          formatX={(v) => `$${v}`}
          formatY={(v) => `${Math.round(v * 100)}%`}
          baseline={0}
          yLabel="implied chance of ending within ±$5"
        >
          {probs.map((p) => (
            <Line.Segment
              key={p.K}
              point1={[p.K, 0]}
              point2={[p.K, clamp(p.p, -0.12, 0.42)]}
              color={p.p < 0 ? 'var(--c-put)' : 'var(--c-prob)'}
              weight={18}
              opacity={0.75}
            />
          ))}
          {probs.map((p) => (
            <Label key={`l${p.K}`} x={p.K} y={clamp(p.p, -0.12, 0.42)} attach={p.p < 0 ? 's' : 'n'} attachDistance={6} size={11} color={p.p < 0 ? 'var(--c-put)' : 'var(--text-muted)'}>
              {Math.round(p.p * 100)}%
            </Label>
          ))}
        </PlotFrame>
      </div>
    </>
  );

  return (
    <WidgetFrame
      title="Bend the curve"
      ariaLabel={`Call prices at strikes from $70 to $130. ${violations.length ? `${violations.length} arbitrage(s) present.` : 'The strip is arbitrage-free.'}`}
      plotHeight={470}
      plot={plot}
      controls={
        <>
          <Button onClick={() => setQuotes(fresh())}>Reset to fair prices</Button>
          <Button onClick={() => setQuotes(fresh().map((q) => (q.K === 100 ? { ...q, C: 12 } : q)))}>Push the $100 call up</Button>
          <Button onClick={() => setQuotes(fresh().map((q) => (q.K === 110 ? { ...q, C: 11 } : q)))}>Overprice the $110 call</Button>
        </>
      }
      readout={
        violations.length === 0 ? (
          <p>
            <strong className="good">No arbitrage.</strong> The prices fall, never faster than $0.95 per $1 of strike, and curve upwards. The bars below are
            the market's implied probabilities, all positive.
          </p>
        ) : (
          <>
            {violations.slice(0, 3).map((v, i) => (
              <p key={i}>
                <strong className="bad">{LABELS[v.kind]}</strong> ({v.strikes.map((k) => `$${k}`).join(', ')}): lock in{' '}
                <strong className="good num">{money(v.profitToday)}</strong> today. {v.trade}
              </p>
            ))}
            {violations.length > 3 && <p className="muted">…and {violations.length - 3} more.</p>}
          </>
        )
      }
      caption="Drag the green points to set each call's price (one-year calls, rate 5%; the dashed curve is Black–Scholes). Red marks a broken rule. Below: each butterfly's price, scaled up, is the implied probability that the stock ends within \$5 of that strike."
    />
  );
}
