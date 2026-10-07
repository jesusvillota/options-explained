import { Line, Polyline } from 'mafs';
import { Fragment, useState } from 'react';
import { balanceAt, growthFactor } from '../../lib/pricing/rates';
import { Segmented, Slider } from '../ui/controls';
import { WidgetFrame } from '../ui/WidgetFrame';
import { money, niceTicks } from './format';
import { Label, PlotFrame } from './PlotFrame';

type Freq = '1' | '2' | '4' | '12' | '365' | 'inf';
const FREQS: { value: Freq; label: string; n: number; name: string }[] = [
  { value: '1', label: 'yearly', n: 1, name: 'once a year' },
  { value: '2', label: '2×', n: 2, name: 'twice a year' },
  { value: '4', label: '4×', n: 4, name: 'quarterly' },
  { value: '12', label: '12×', n: 12, name: 'monthly' },
  { value: '365', label: '365×', n: 365, name: 'daily' },
  { value: 'inf', label: '∞', n: Infinity, name: 'continuously' },
];
const HEIGHT = 320;
const PRINCIPAL = 100;

/**
 * Chapter 6: $100 growing for a year when interest is credited n times a
 * year (a staircase), against continuous compounding (the smooth curve e^{rt}).
 */
export default function CompoundingStaircase({ initialRate = 0.4 }: { initialRate?: number }) {
  const [rate, setRate] = useState(initialRate);
  const [freq, setFreq] = useState<Freq>('4');
  const f = FREQS.find((x) => x.value === freq)!;
  const top = PRINCIPAL * Math.exp(rate);
  const yTicks = niceTicks(PRINCIPAL, top, 4);
  const Y: [number, number] = [PRINCIPAL - (top - PRINCIPAL) * 0.08, top + (top - PRINCIPAL) * 0.12];

  // Staircase: flat between credit dates, jumping at each one.
  const stairs: [number, number][] = [];
  if (f.n !== Infinity) {
    const steps = Math.min(f.n, 400);
    for (let k = 0; k < steps; k++) {
      const v = PRINCIPAL * balanceAt(rate, k / f.n, f.n);
      stairs.push([k / f.n, v], [(k + 1) / f.n, v]);
    }
    stairs.push([1, PRINCIPAL * balanceAt(rate, 1, f.n)]);
  }
  const smooth = Array.from({ length: 101 }, (_, i) => [i / 100, PRINCIPAL * Math.exp(rate * (i / 100))] as [number, number]);
  const final = PRINCIPAL * growthFactor(rate, 1, f.n);

  const plot = (
    <PlotFrame
      x={[0, 1]}
      y={Y}
      height={HEIGHT}
      xTicks={[0, 0.25, 0.5, 0.75, 1]}
      yTicks={yTicks}
      formatX={(t) => (t === 0 ? 'today' : t === 1 ? '1 year' : `${Math.round(t * 12)} mo`)}
      formatY={(v) => `$${v}`}
      yLabel="balance"
    >
      <Polyline points={smooth} color="var(--c-rate)" weight={2} strokeStyle="dashed" fillOpacity={0} strokeOpacity={0.8} />
      {f.n !== Infinity && <Polyline points={stairs} color="var(--c-rate)" weight={3.5} fillOpacity={0} />}
      <Line.Segment point1={[0, top]} point2={[1, top]} color="var(--c-rate)" style="dashed" weight={1} opacity={0.4} />
      <Label x={0.02} y={top} attach="se" attachDistance={6} size={12} color="var(--c-rate)">
        continuous: {money(top)}
      </Label>
      <Label x={1} y={final} attach="sw" attachDistance={8} size={13} color="var(--text)">
        {f.name}: {money(final)}
      </Label>
    </PlotFrame>
  );

  const rows = FREQS.map((x) => ({ ...x, v: PRINCIPAL * growthFactor(rate, 1, x.n) }));
  return (
    <WidgetFrame
      title="Compounding more and more often"
      ariaLabel={`$100 at ${Math.round(rate * 100)}% grows to ${money(final)} in a year when compounded ${f.name}, versus ${money(top)} continuously.`}
      plotHeight={HEIGHT}
      plot={plot}
      controls={
        <>
          <Segmented label="Compounding frequency" value={freq} onChange={setFreq} options={FREQS.map((x) => ({ value: x.value, label: x.label, color: 'var(--c-rate)' }))} />
          <Slider label="Interest rate $\Rate{r}$" value={rate} min={0.01} max={1} step={0.01} onChange={setRate} format={(v) => `${Math.round(v * 100)}%`} color="var(--c-rate)" />
        </>
      }
      readout={
        <dl className="readout-grid">
          {rows.map((x) => (
            <Fragment key={x.value}>
              <dt>{x.name}</dt>
              <dd style={x.value === freq ? { color: 'var(--c-rate)' } : undefined}>{money(x.v)}</dd>
            </Fragment>
          ))}
        </dl>
      }
      caption="Solid: interest credited in steps. Dashed: continuous compounding, the limit as the steps get infinitely small. A big rate makes the steps easy to see."
    />
  );
}
