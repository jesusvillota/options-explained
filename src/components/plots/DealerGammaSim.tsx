import { Line, Point, Polygon, Polyline } from 'mafs';
import { useMemo, useState } from 'react';
import { FEEDBACK_MARKET, FEEDBACK_STRIKES, POSITIONING, dealerGamma, gammaFlip, gexByStrike, multiplier, realisedVol, simulateFeedback } from '../../lib/feedback/dealerGamma';
import { Button, Select, Slider } from '../ui/controls';
import { WidgetFrame } from '../ui/WidgetFrame';
import { extent, niceTicks } from './format';
import { Label, PlotFrame } from './PlotFrame';

type Positioning = keyof typeof POSITIONING;
const STEPS_PER_DAY = 13;
const DT = 1 / (252 * STEPS_PER_DAY);
const SPOTS = Array.from({ length: 81 }, (_, i) => 80 + i * 0.5);
const millions = (v: number) => `${v < 0 ? '−' : v > 0 ? '+' : ''}$${Math.abs(v).toFixed(0)}M`;

interface DealerGammaSimProps {
  title?: string;
  initialPositioning?: Positioning;
}

/**
 * Chapter 66: dealers' gamma and the feedback from their hedging. Top: gamma
 * exposure per strike (dollars of stock to trade per 1% move) and the net
 * exposure as a function of spot, with the "gamma flip". Bottom: the same
 * random shocks with and without dealers' hedging flowing through impact.
 */
export default function DealerGammaSim({ title = 'Dealer gamma and feedback', initialPositioning = 'index' }: DealerGammaSimProps) {
  const [positioning, setPositioning] = useState<Positioning>(initialPositioning);
  const [impact, setImpact] = useState(0.4); // % move from 1 million shares
  const [seed, setSeed] = useState(66);
  const lambda = (impact / 100) * FEEDBACK_MARKET.S0 / 1e6;
  const pos = POSITIONING[positioning].positions;
  const tau0 = FEEDBACK_MARKET.tau0;

  const gex = useMemo(() => gexByStrike(100, tau0, pos).map((g) => g / 1e6), [positioning]);
  const net = useMemo(() => SPOTS.map((S) => [S, (dealerGamma(S, tau0, pos) * S * S * 0.01) / 1e6] as [number, number]), [positioning]);
  const flip = useMemo(() => gammaFlip(tau0, pos), [positioning]);
  const path = useMemo(() => simulateFeedback({ seed, lambda, positions: pos, stepsPerDay: STEPS_PER_DAY }), [seed, lambda, positioning]);

  const [gLo, gHi] = extent([...gex, ...net.map((p) => p[1]), 0]);
  const gPad = (gHi - gLo) * 0.15 || 5;
  const gTop = gHi + (gHi - gLo) * 0.35 + 5; // room for the axis title
  const top = (
    <PlotFrame x={[78, 122]} y={[gLo - gPad, gTop]} height={190} xTicks={FEEDBACK_STRIKES} yTicks={niceTicks(gLo - gPad, gHi, 4)} formatX={(v) => `$${v}`} formatY={millions} yLabel="dealer gamma ($ per 1% move)" baseline={0} marginLeft={52}>
      {FEEDBACK_STRIKES.map((K, i) => gex[i] !== 0 && (
        <Polygon key={K} points={[[K - 1.5, 0], [K + 1.5, 0], [K + 1.5, gex[i]], [K - 1.5, gex[i]]]} color={K < 100 ? 'var(--c-put)' : 'var(--c-call)'} fillOpacity={0.5} strokeOpacity={0.9} weight={1} />
      ))}
      <Polyline points={net} color="var(--text)" weight={2.5} fillOpacity={0} />
      {flip !== null && (
        <>
          <Line.Segment point1={[flip, gLo - gPad]} point2={[flip, gTop]} color="var(--text-muted)" weight={1.5} style="dashed" />
          <Label x={flip} y={gLo - gPad} attach="ne" attachDistance={4} size={11} color="var(--text-muted)">{`gamma flip $${flip.toFixed(1)}`}</Label>
        </>
      )}
      <Point x={100} y={(dealerGamma(100, tau0, pos) * 100) / 1e6} color="var(--c-spot)" />
    </PlotFrame>
  );

  const [pLo, pHi] = extent([...path.fundamental, ...path.price]);
  const pad = (pHi - pLo) * 0.1 + 0.5;
  const bottom = (
    <div style={{ borderTop: '1px solid var(--border)' }}>
      <PlotFrame x={[0, 21]} y={[pLo - pad, pHi + pad + (pHi - pLo) * 0.15]} height={200} xTicks={[0, 5, 10, 15, 20]} yTicks={niceTicks(pLo - pad, pHi + pad, 4)} formatX={(v) => `day ${v}`} formatY={(v) => `$${v}`} yLabel="stock price" marginLeft={44}>
        {flip !== null && flip > pLo - pad && flip < pHi + pad && (
          <Line.Segment point1={[0, flip]} point2={[21, flip]} color="var(--text-muted)" weight={1} style="dashed" />
        )}
        <Polyline points={path.t.map((t, i) => [t, path.fundamental[i]] as [number, number])} color="var(--text-muted)" weight={1.5} fillOpacity={0} />
        <Polyline points={path.t.map((t, i) => [t, path.price[i]] as [number, number])} color="var(--c-spot)" weight={2.5} fillOpacity={0} />
      </PlotFrame>
    </div>
  );

  const g0 = dealerGamma(100, tau0, pos);
  const rv0 = realisedVol(path.fundamental, DT), rv1 = realisedVol(path.price, DT);
  return (
    <WidgetFrame
      title={title}
      ariaLabel={`${POSITIONING[positioning].label}. Realised volatility over the month: ${(rv0 * 100).toFixed(1)}% without dealer hedging, ${(rv1 * 100).toFixed(1)}% with it.`}
      plotHeight={390}
      plot={<>{top}{bottom}</>}
      controls={
        <>
          <Select label="Who holds what" value={positioning} onChange={setPositioning} options={Object.entries(POSITIONING).map(([k, p]) => ({ value: k as Positioning, label: p.label }))} />
          <Slider label="Price impact of 1 million shares" value={impact} min={0} max={1} step={0.05} onChange={setImpact} format={(v) => `${v.toFixed(2)}%`} />
          <Button onClick={() => setSeed((s) => s + 1)}>Re-simulate</Button>
        </>
      }
      readout={
        <dl className="readout-grid">
          <dt>Dealer gamma at $100</dt><dd>{g0 >= 0 ? '+' : '−'}{Math.abs(g0 / 1000).toFixed(0)}k shares per $1 <span className="muted">moves scaled by {multiplier(lambda, g0).toFixed(2)}×</span></dd>
          <dt>Realised volatility</dt><dd>{(rv1 * 100).toFixed(1)}% <span className="muted">with dealers, against {(rv0 * 100).toFixed(1)}% without</span></dd>
          <dt>Gamma flip</dt><dd>{flip === null ? 'none in range' : `$${flip.toFixed(1)}`} <span className="muted">{flip === null ? '' : 'dealers are short gamma below it'}</span></dd>
        </dl>
      }
      caption="Two-month options on a \$100 stock with 20% volatility; dealers' net positions per strike (puts below \$100 in red, calls in green). The black curve is dealers' total gamma exposure if the stock were at each price. Bottom: one month of the stock, driven by the same random shocks, without dealers (grey) and with dealers' hedging trades moving the price (blue). The dashed line marks the gamma flip."
    />
  );
}
