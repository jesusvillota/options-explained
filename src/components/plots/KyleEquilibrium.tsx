import { Line, Plot, Point, Polyline } from 'mafs';
import { useMemo, useState } from 'react';
import { bestResponsePath, kyleEquilibrium, makerBestResponse, simulateKyle } from '../../lib/info/kyle';
import { Button, Slider } from '../ui/controls';
import { WidgetFrame } from '../ui/WidgetFrame';
import { money } from './format';
import { Label, PlotFrame } from './PlotFrame';

const P0 = 2.48;
const MULTIPLIER = 100;
const B_MAX = 1500; // contracts per $1 of private information
const L_MAX = 40; // cents per 100 contracts
/** λ in $ per contract → cents per 100 contracts. */
const toCents = (lambda: number) => lambda * 1e4;

interface KyleEquilibriumProps {
  title?: string;
}

/**
 * Chapter 51: Kyle's equilibrium as the crossing of two best responses. The
 * insider picks how aggressively to trade (β) given the market maker's price
 * impact (λ); the market maker picks λ given β. Taking turns converges to the
 * crossing. Bottom: in equilibrium, the price moves exactly half way from the
 * prior to the true value, on average.
 */
export default function KyleEquilibrium({ title = "Kyle's equilibrium" }: KyleEquilibriumProps) {
  const [s0, setS0] = useState(0.3);
  const [su, setSu] = useState(100);
  const [lambda0Cents, setLambda0Cents] = useState(35);
  const [steps, setSteps] = useState(0);
  const S0 = s0 * s0;
  const eq = kyleEquilibrium(S0, su);
  const path = bestResponsePath(lambda0Cents / 1e4, S0, su, steps);
  const draws = useMemo(() => simulateKyle(P0, S0, su, 160, 51), [S0, su]);

  // Staircase: start on the λ axis, then alternate horizontal moves (insider) and vertical moves (market maker).
  const stair: [number, number][] = [[0, toCents(path[0].lambda)]];
  path.forEach((pt, i) => {
    stair.push([Math.min(pt.beta, B_MAX), toCents(pt.lambda)]);
    if (i < path.length - 1) stair.push([Math.min(pt.beta, B_MAX), toCents(path[i + 1].lambda)]);
  });
  const last = path[path.length - 1];

  const top = (
    <PlotFrame x={[0, B_MAX]} y={[0, L_MAX]} height={240} xTicks={[0, 250, 500, 750, 1000, 1250, 1500]} yTicks={[0, 10, 20, 30, 40]} formatY={(v) => `${v}¢`} xLabel="insider's aggressiveness β (contracts per $1 of news)" yLabel="price impact λ (¢ per 100 contracts)" marginLeft={44}>
      <Plot.OfX y={(b) => toCents(1 / (2 * Math.max(b, 1e-6)))} color="var(--c-put)" weight={2.5} domain={[toCents(1) / (2 * L_MAX) * 1e0, B_MAX]} />
      <Plot.OfX y={(b) => toCents(makerBestResponse(b, S0, su))} color="var(--text)" weight={2.5} domain={[0, B_MAX]} />
      <Polyline points={stair} color="var(--c-strike)" weight={1.5} strokeStyle="dashed" fillOpacity={0} />
      <Point x={Math.min(last.beta, B_MAX)} y={toCents(last.lambda)} color="var(--c-strike)" />
      {eq.beta < B_MAX && <Point x={eq.beta} y={toCents(eq.lambda)} color="var(--text)" />}
      <Label x={B_MAX} y={toCents(1 / (2 * B_MAX))} attach="nw" attachDistance={6} size={11} color="var(--c-put)">insider: β = 1/(2λ)</Label>
      <Label x={B_MAX} y={toCents(makerBestResponse(B_MAX, S0, su))} attach="nw" attachDistance={14} size={11} color="var(--text)">market maker: λ = E[v | y] slope</Label>
    </PlotFrame>
  );

  const lo = P0 - 3 * s0, hi = P0 + 3 * s0;
  const bottom = (
    <div style={{ borderTop: '1px solid var(--border)' }}>
      <PlotFrame x={[lo, hi]} y={[lo, hi]} height={200} xTicks={[P0 - 2 * s0, P0 - s0, P0, P0 + s0, P0 + 2 * s0]} yTicks={[P0 - 2 * s0, P0, P0 + 2 * s0]} formatX={(v) => v.toFixed(2)} formatY={(v) => v.toFixed(2)} xLabel="true value v" yLabel="price after trading p" marginLeft={44}>
        <Line.Segment point1={[lo, lo]} point2={[hi, hi]} color="var(--text-muted)" style="dashed" weight={1} />
        <Line.Segment point1={[lo, P0 + 0.5 * (lo - P0)]} point2={[hi, P0 + 0.5 * (hi - P0)]} color="var(--c-strike)" weight={2} />
        {draws.map((d, i) => <Point key={i} x={Math.min(Math.max(d.v, lo), hi)} y={Math.min(Math.max(d.p, lo), hi)} color="var(--c-spot)" opacity={0.5} />)}
        <Label x={hi} y={hi} attach="sw" attachDistance={6} size={11} color="var(--text-muted)">full revelation</Label>
        <Label x={hi} y={P0 + 0.5 * (hi - P0)} attach="nw" attachDistance={6} size={11} color="var(--c-strike)">slope ½</Label>
      </PlotFrame>
    </div>
  );

  return (
    <WidgetFrame
      title={title}
      ariaLabel={`Kyle equilibrium: price impact ${toCents(eq.lambda).toFixed(1)} cents per 100 contracts, insider trades ${eq.beta.toFixed(0)} contracts per dollar of private information.`}
      plotHeight={440}
      plot={<>{top}{bottom}</>}
      controls={
        <>
          <Slider label="Insider's information, $\sqrt{\Sigma_0}$" value={s0} min={0.1} max={0.6} step={0.01} onChange={setS0} format={(v) => `${Math.round(v * 100)}¢`} color="var(--c-put)" />
          <Slider label="Noise trading, $\sigma_u$" value={su} min={20} max={300} step={5} onChange={setSu} format={(v) => `${v} contracts`} />
          <Slider label="Starting guess for $\lambda$" value={lambda0Cents} min={2} max={40} step={1} onChange={(v) => { setLambda0Cents(v); setSteps(0); }} format={(v) => `${v}¢`} color="var(--c-strike)" />
          <Button onClick={() => setSteps((s) => Math.min(s + 1, 8))}>Best-respond ({steps})</Button>
          <Button onClick={() => setSteps(0)} disabled={steps === 0}>Reset</Button>
        </>
      }
      readout={
        <dl className="readout-grid">
          <dt>Price impact λ</dt><dd>{toCents(eq.lambda).toFixed(2)}¢ per 100 contracts <span className="muted">= √Σ0 / (2σ_u); depth 1/λ = {Math.round(1 / eq.lambda).toLocaleString('en-US')} contracts per $1</span></dd>
          <dt>Insider's order</dt><dd>{eq.beta.toFixed(0)} contracts per $1 of news <span className="muted">= σ_u / √Σ0</span></dd>
          <dt>After the trade</dt><dd>uncertainty falls from {Math.round(s0 * 100)}¢ to {Math.round(Math.sqrt(eq.posteriorVar) * 100)}¢ <span className="muted">(variance halved)</span></dd>
          <dt>Insider's profit</dt><dd className="good">{money(eq.insiderProfit * MULTIPLIER, 0)} <span className="muted">expected, = noise traders' loss σ_u√Σ0/2 × 100</span></dd>
          <dt>Turn by turn</dt><dd>{steps === 0 ? 'press Best-respond' : `λ = ${toCents(last.lambda).toFixed(2)}¢ after ${steps} turn${steps > 1 ? 's' : ''}`}</dd>
        </dl>
      }
      caption="Top: the insider's best response (red) and the market maker's (white, black in the light theme) cross at the equilibrium. The dashed staircase alternates the two from your starting guess. Bottom: 160 simulated trading rounds. The price after trading moves, on average, exactly half way from 2.48 towards the true value."
    />
  );
}
