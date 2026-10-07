import { Line, Polygon, Polyline } from 'mafs';
import { useMemo, useState } from 'react';
import { lognormalCdf, lognormalPdf } from '../../lib/math/lognormal';
import { forwardOf, impliedDensity, impliedTailProbability } from '../../lib/vol/density';
import { EQUITY_SSVI, ssviVol, type SSVIParams } from '../../lib/vol/smile';
import { Segmented, Slider } from '../ui/controls';
import { WidgetFrame } from '../ui/WidgetFrame';
import { Label, PlotFrame } from './PlotFrame';

type Tenor = '0.25' | '1';
const S = 100, r = 0.05;
const RANGE: Record<Tenor, [number, number]> = { '0.25': [60, 140], '1': [40, 180] };
const pct = (v: number, d = 0) => `${(v * 100).toFixed(d)}%`;

/** Split a curve into runs where pred holds, for drawing the negative parts in another colour. */
function runs(points: [number, number][], pred: (y: number) => boolean): [number, number][][] {
  const out: [number, number][][] = [];
  let cur: [number, number][] = [];
  for (const p of points) {
    if (pred(p[1])) cur.push(p);
    else if (cur.length) { out.push(cur); cur = []; }
  }
  if (cur.length) out.push(cur);
  return out;
}

/**
 * Chapter 27: the smile on top, the risk-neutral density it implies below
 * (Breeden–Litzenberger), against the lognormal at the at-the-money vol. Steep
 * wings make the density negative: a butterfly with a negative price.
 */
export default function ImpliedDensity() {
  const [tenor, setTenor] = useState<Tenor>('0.25');
  const [p, setP] = useState<SSVIParams>({ ...EQUITY_SSVI });
  const T = Number(tenor);
  const [k0, k1] = RANGE[tenor];
  const market = { S, K: S, T, r };
  const smile = (k: number) => ssviVol(k, T, p);
  const F = forwardOf(market);
  const ln = { S0: S, mu: r, sigma: p.atmVol, T };

  const { vols, dens } = useMemo(() => {
    const xs = Array.from({ length: 161 }, (_, i) => k0 + ((k1 - k0) * i) / 160);
    return {
      vols: xs.map((K) => [K, smile(Math.log(K / F))] as [number, number]),
      dens: xs.map((K) => [K, impliedDensity(K, market, smile, 0.25)] as [number, number]),
    };
  }, [tenor, p.atmVol, p.rho, p.eta]);
  const lognormal = dens.map(([K]) => [K, lognormalPdf(K, ln)] as [number, number]);
  const dMax = Math.max(...dens.map(([, d]) => d), ...lognormal.map(([, d]) => d)) * 1.1;
  const dMin = Math.min(0, ...dens.map(([, d]) => d)) * 1.1;
  const negative = dens.filter(([, d]) => d < -1e-6);
  const vMax = Math.min(Math.max(...vols.map(([, v]) => v)) * 1.4, 1.5); // headroom for the axis label

  const down = 0.8 * S, up = 1.2 * S;
  const pDown = 1 - impliedTailProbability(down, market, smile);
  const pUp = impliedTailProbability(up, market, smile);
  const pDownBS = lognormalCdf(down, ln);
  const pUpBS = 1 - lognormalCdf(up, ln);

  const top = (
    <PlotFrame x={[k0, k1]} y={[0, vMax]} height={140} xTicks={[]} yTicks={[0, 0.2, 0.4, 0.6, 0.8, 1].filter((t) => t < vMax)} formatY={(v) => pct(v)} yLabel="implied vol">
      <Line.Segment point1={[k0, p.atmVol]} point2={[k1, p.atmVol]} color="var(--text-muted)" style="dashed" weight={1} />
      <Polyline points={vols} color="var(--c-vol)" weight={2.5} fillOpacity={0} />
    </PlotFrame>
  );
  const bottom = (
    <div style={{ borderTop: '1px solid var(--border)' }}>
      <PlotFrame x={[k0, k1]} y={[dMin, dMax]} height={210} xTicks={tenor === '1' ? [40, 60, 80, 100, 120, 140, 160, 180] : [60, 80, 100, 120, 140]} yTicks={[]} formatX={(v) => `$${v}`} baseline={0} xLabel="stock price at expiry" yLabel="risk-neutral density">
        <Polygon points={[[k0, 0], ...dens.map(([K, d]) => [K, Math.max(d, 0)] as [number, number]), [k1, 0]]} color="var(--c-prob)" fillOpacity={0.22} strokeOpacity={0} />
        <Polyline points={lognormal} color="var(--text-muted)" weight={1.5} strokeStyle="dashed" fillOpacity={0} />
        <Polyline points={dens} color="var(--c-prob)" weight={2.5} fillOpacity={0} />
        {runs(dens, (d) => d < 0).map((run, i) => <Polyline key={i} points={run} color="var(--c-put)" weight={3.5} fillOpacity={0} />)}
        <Label x={k1} y={lognormal[150][1]} attach="nw" attachDistance={8} size={12} color="var(--text-muted)">lognormal</Label>
      </PlotFrame>
    </div>
  );

  return (
    <WidgetFrame
      title="The density hidden in the smile"
      ariaLabel={`Smile and implied density for ${tenor === '1' ? 'one year' : 'three months'}. Probability of a 20% fall: ${pct(pDown, 1)} from the smile versus ${pct(pDownBS, 1)} lognormal.${negative.length ? ' The density is negative somewhere: butterfly arbitrage.' : ''}`}
      plotHeight={350}
      plot={<>{top}{bottom}</>}
      controls={
        <>
          <Segmented label="Expiry" value={tenor} onChange={setTenor} options={[
            { value: '0.25', label: '3 months' },
            { value: '1', label: '1 year' },
          ]} />
          <Slider label="At-the-money vol" value={p.atmVol} min={0.1} max={0.4} step={0.01} onChange={(v) => setP({ ...p, atmVol: v })} format={(v) => pct(v)} color="var(--c-vol)" />
          <Slider label="Skew ρ" value={p.rho} min={-0.95} max={0.95} step={0.05} onChange={(v) => setP({ ...p, rho: v })} format={(v) => v.toFixed(2)} color="var(--c-vol)" />
          <Slider label="Wings η" value={p.eta} min={0} max={4} step={0.1} onChange={(v) => setP({ ...p, eta: v })} format={(v) => v.toFixed(1)} color="var(--c-vol)" />
        </>
      }
      readout={
        <dl className="readout-grid">
          <dt>Q(fall of 20% or more)</dt><dd>{pct(pDown, 1)} <span className="muted">(lognormal {pct(pDownBS, 1)})</span></dd>
          <dt>Q(rise of 20% or more)</dt><dd>{pct(pUp, 1)} <span className="muted">(lognormal {pct(pUpBS, 1)})</span></dd>
          <dt>Arbitrage</dt>
          <dd className={negative.length ? 'bad' : 'good'}>
            {negative.length ? `density < 0 near $${Math.round(negative[Math.floor(negative.length / 2)][0])}: a butterfly there has a negative price` : 'none: the density is non-negative'}
          </dd>
        </dl>
      }
      caption="Top: an SSVI smile (dashed: flat at the at-the-money vol). Bottom: $e^{\Rate{r}\Time{T}}\,\partial^2\Call{C}/\partial\Strike{K}^2$ computed from the smile's call prices, against the lognormal density of Black–Scholes at the at-the-money vol."
    />
  );
}
