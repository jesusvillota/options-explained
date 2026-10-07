import { Line, Polyline } from 'mafs';
import { useMemo, useState } from 'react';
import { gbmPath } from '../../lib/math/rng';
import { mertonFirm } from '../../lib/theory/credit';
import { Button, Slider } from '../ui/controls';
import { WidgetFrame } from '../ui/WidgetFrame';
import { extent, money, niceTicks } from './format';
import { Label, PlotFrame } from './PlotFrame';

const D = 100, r = 0.03, T = 5, PATHS = 12;
const pct = (v: number, d = 1) => `${(v * 100).toFixed(d)}%`;

/**
 * Chapter 42: Merton's model. Top: simulated firm-value paths over five years
 * against the debt that falls due (paths ending below it default). Bottom: the
 * credit spread the model implies for each maturity of debt.
 */
export default function MertonCredit() {
  const [A, setA] = useState(140);
  const [sigmaA, setSigmaA] = useState(0.25);
  const [seed, setSeed] = useState(1);
  const firm = mertonFirm({ A, D, T, r, sigmaA });
  const paths = useMemo(() => Array.from({ length: PATHS }, (_, i) => gbmPath(seed * 40 + i, A, 0.06, sigmaA, T, 120)), [A, sigmaA, seed]);
  const defaults = paths.filter((p) => p[p.length - 1] < D).length;
  const [lo, hi] = extent([...paths.flat(), D]);
  const mats = Array.from({ length: 60 }, (_, i) => 0.1 + (i * 9.9) / 59);
  const spreads = mats.map((m) => [m, mertonFirm({ A, D, T: m, r, sigmaA }).spread * 10000] as [number, number]);
  const sMax = Math.max(...spreads.map(([, s]) => s), 50) * 1.15;

  const top = (
    <PlotFrame x={[0, T]} y={[Math.max(lo * 0.9, 0), hi * 1.05]} height={190} xTicks={[0, 1, 2, 3, 4, 5]} yTicks={niceTicks(Math.max(lo * 0.9, 0), hi * 1.05, 4)} formatX={(v) => `${v}y`} formatY={(v) => money(v, 0)} yLabel="firm's assets">
      <Line.Segment point1={[0, D]} point2={[T, D]} color="var(--c-put)" weight={2} />
      <Label x={0.05} y={D} attach="se" attachDistance={4} size={12} color="var(--c-put)">debt due at year 5: {money(D, 0)}</Label>
      {paths.map((p, i) => (
        <Polyline key={i} points={p.map((v, j) => [(j / 120) * T, v] as [number, number])} color={p[p.length - 1] < D ? 'var(--c-put)' : 'var(--c-spot)'} weight={1.4} strokeOpacity={0.75} fillOpacity={0} />
      ))}
    </PlotFrame>
  );
  const bottom = (
    <div style={{ borderTop: '1px solid var(--border)' }}>
      <PlotFrame x={[0, 10]} y={[0, sMax]} height={140} xTicks={[0, 2, 4, 6, 8, 10]} yTicks={niceTicks(0, sMax, 4)} formatX={(v) => `${v}y`} formatY={(v) => `${Math.round(v)}`} xLabel="maturity of the debt" yLabel="credit spread (bp)">
        <Polyline points={spreads} color="var(--c-rate)" weight={2.5} fillOpacity={0} />
        <Line.Segment point1={[T, 0]} point2={[T, sMax]} color="var(--text-muted)" style="dashed" weight={1} />
      </PlotFrame>
    </div>
  );

  return (
    <WidgetFrame
      title="Equity is a call on the firm"
      ariaLabel={`Firm with assets ${A} and asset volatility ${Math.round(sigmaA * 100)}% owing ${D} in five years: equity ${money(firm.equity)}, debt ${money(firm.debt)}, risk-neutral default probability ${pct(firm.defaultProbability)}, spread ${Math.round(firm.spread * 10000)} bp.`}
      plotHeight={330}
      plot={<>{top}{bottom}</>}
      controls={
        <>
          <Slider label="Asset value A" value={A} min={95} max={250} step={5} onChange={setA} format={(v) => money(v, 0)} color="var(--c-spot)" />
          <Slider label="Asset volatility σ_A" value={sigmaA} min={0.05} max={0.6} step={0.01} onChange={setSigmaA} format={(v) => `${Math.round(v * 100)}%`} color="var(--c-vol)" />
          <Button onClick={() => setSeed((s) => s + 1)}>New paths</Button>
        </>
      }
      readout={
        <dl className="readout-grid">
          <dt>Equity (a call on A, strike D)</dt><dd>{money(firm.equity)} <span className="muted">equity volatility {pct(firm.equityVol, 0)}</span></dd>
          <dt>Debt (bond − put)</dt><dd>{money(firm.debt)} <span className="muted">spread {Math.round(firm.spread * 10000)} bp over {pct(r, 0)}</span></dd>
          <dt>Default probability (risk-neutral)</dt><dd>{pct(firm.defaultProbability)} <span className="muted">{defaults} of {PATHS} paths shown default</span></dd>
        </dl>
      }
      caption="Debt of \$100 due in 5 years, $\Rate{r} = 3\%$. Paths use a 6% real-world drift, so their default rate is below the risk-neutral probability. Bottom: the spread on zero-coupon debt of each maturity (dashed: 5 years)."
    />
  );
}
