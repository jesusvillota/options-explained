import { Polygon } from 'mafs';
import { useState } from 'react';
import { ssviVol } from '../../lib/vol/smile';
import { vixTerms } from '../../lib/vol/varianceSwap';
import { Segmented, Slider } from '../ui/controls';
import { WidgetFrame } from '../ui/WidgetFrame';
import { niceTicks } from './format';
import { Label, PlotFrame } from './PlotFrame';

type Spacing = '1' | '5' | '10';
const T = 30 / 365;
const market = { S: 100, K: 100, T, r: 0.05 };
const K_MIN = 50, K_MAX = 150;
const HEIGHT = 280;

/**
 * Chapter 28: the VIX formula strike by strike for a 30-day smile. Each bar is
 * one option's contribution (2/T)·ΔK/K²·e^{rT}·Q(K) to σ², in VIX² points.
 */
export default function VixContributions() {
  const [spacing, setSpacing] = useState<Spacing>('5');
  const [atm, setAtm] = useState(0.18);
  const [rho, setRho] = useState(-0.6);
  const [eta, setEta] = useState(0.8);
  const dK = Number(spacing);
  const strikes = Array.from({ length: Math.round((K_MAX - K_MIN) / dK) + 1 }, (_, i) => K_MIN + i * dK);
  const smile = (k: number) => ssviVol(k, T, { atmVol: atm, rho, eta });
  const { terms, correction, K0 } = vixTerms(market, smile, strikes);
  const scale = 1e4 / dK; // VIX² points per $1 of strike, so bar heights don't depend on the spacing
  const sigma2 = terms.reduce((a, t) => a + t.contribution, 0) - correction;
  // The strike at K₀ is half put, half call, so it counts half to each side.
  const total = sigma2 + correction;
  const putShare = terms.reduce((a, t) => a + (t.kind === 'put' ? 1 : t.kind === 'both' ? 0.5 : 0) * t.contribution, 0) / total;
  const yMax = Math.max(...terms.map((t) => t.contribution * scale)) * 1.15;

  return (
    <WidgetFrame
      title="Inside the VIX formula"
      ariaLabel={`30-day VIX from ${strikes.length} strikes: ${(100 * Math.sqrt(sigma2)).toFixed(1)}, against an at-the-money vol of ${(atm * 100).toFixed(0)}%. Puts contribute ${(putShare * 100).toFixed(0)}%.`}
      plotHeight={HEIGHT}
      plot={
        <PlotFrame x={[K_MIN - 3, K_MAX + 3]} y={[0, yMax]} height={HEIGHT} xTicks={[50, 70, 90, 110, 130, 150]} yTicks={niceTicks(0, yMax, 4)} formatX={(v) => `$${v}`} formatY={(v) => v.toFixed(0)} xLabel="strike" yLabel="contribution to VIX² per $1 of strike" marginLeft={44}>
          {terms.map((t) => {
            const w = Math.min(dK * 0.8, 4) / 2;
            const h = t.contribution * scale;
            return <Polygon key={t.K} points={[[t.K - w, 0], [t.K + w, 0], [t.K + w, h], [t.K - w, h]]} color={t.kind === 'put' ? 'var(--c-put)' : t.kind === 'call' ? 'var(--c-call)' : 'var(--c-strike)'} fillOpacity={0.6} strokeOpacity={0.8} weight={1} />;
          })}
          <Label x={K0 - 20} y={yMax * 0.85} attach="w" size={12} color="var(--c-put)">puts</Label>
          <Label x={K0 + 20} y={yMax * 0.85} attach="e" size={12} color="var(--c-call)">calls</Label>
        </PlotFrame>
      }
      controls={
        <>
          <Segmented label="Strike spacing" value={spacing} onChange={setSpacing} options={[
            { value: '10', label: '$10' },
            { value: '5', label: '$5' },
            { value: '1', label: '$1' },
          ]} />
          <Slider label="At-the-money vol" value={atm} min={0.1} max={0.6} step={0.01} onChange={setAtm} format={(v) => `${Math.round(v * 100)}%`} color="var(--c-vol)" />
          <Slider label="Skew ρ" value={rho} min={-0.9} max={0.3} step={0.05} onChange={setRho} format={(v) => v.toFixed(2)} color="var(--c-vol)" />
          <Slider label="Wings η" value={eta} min={0} max={1.5} step={0.05} onChange={setEta} format={(v) => v.toFixed(2)} color="var(--c-vol)" />
        </>
      }
      readout={
        <dl className="readout-grid">
          <dt>VIX = 100·√σ²</dt><dd>{(100 * Math.sqrt(Math.max(sigma2, 0))).toFixed(2)} <span className="muted">(at-the-money vol {(atm * 100).toFixed(0)}%)</span></dd>
          <dt>Share from puts</dt><dd>{(putShare * 100).toFixed(0)}%</dd>
          <dt>Forward correction</dt><dd>−{(correction * 1e4).toFixed(3)} <span className="muted">VIX² points, (1/T)(F/K₀ − 1)² with K₀ = {K0}</span></dd>
        </dl>
      }
      caption="A 30-day SSVI smile on a \$100 index with $\Rate{r} = 5\%$. Bars are each strike's term in the Cboe formula, per \$1 of strike: red for out-of-the-money puts, green for calls, yellow for the strike just below the forward."
    />
  );
}
