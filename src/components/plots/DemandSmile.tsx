import { Line, Plot, Point, Polygon } from 'mafs';
import { useMemo, useState } from 'react';
import { DEMAND_PRESETS, DEMAND_STRIKES, demandSmile } from '../../lib/mm/demand';
import { Select, Slider } from '../ui/controls';
import { WidgetFrame } from '../ui/WidgetFrame';
import { money, niceTicks } from './format';
import { Label, PlotFrame } from './PlotFrame';

type Preset = keyof typeof DEMAND_PRESETS;
const MULTIPLIER = 100;
const X: [number, number] = [82, 118];

interface DemandSmileProps {
  title?: string;
  initialPreset?: Preset;
}

/**
 * Chapter 60: dealers who can't fully hedge charge for absorbing end users' net
 * demand. Even with a flat 20% "true" volatility, demand shapes the smile.
 * Top: implied volatility with the demand premium. Bottom: net end-user demand
 * by strike (positive = end users buy).
 */
export default function DemandSmile({ title = 'Demand shapes the smile', initialPreset = 'index' }: DemandSmileProps) {
  const [preset, setPreset] = useState<Preset>(initialPreset);
  const [scale, setScale] = useState(1);
  const [g, setG] = useState(3);
  const demand = DEMAND_PRESETS[preset].demand.map((d) => d * scale);
  const smile = useMemo(() => demandSmile(demand, g * 1e-6), [preset, scale, g]);
  const vols = smile.map((s) => s.withDemand);
  const yLo = Math.min(0.17, ...vols) - 0.005, yHi = Math.max(0.24, ...vols) + 0.025;
  const yTicks = niceTicks(yLo, yHi, 4);
  const at = (K: number) => smile.find((s) => s.strike === K)!;

  const top = (
    <PlotFrame x={X} y={[yLo, yHi]} height={220} xTicks={DEMAND_STRIKES} yTicks={yTicks} formatX={(v) => `$${v}`} formatY={(v) => `${(v * 100).toFixed(0)}%`} yLabel="implied volatility" marginLeft={44}>
      <Plot.OfX y={() => 0.2} color="var(--c-vol)" style="dashed" weight={1.5} domain={X} />
      <Label x={X[1]} y={0.2} attach="nw" attachDistance={4} size={11} color="var(--c-vol)">hedgeable value: 20%</Label>
      {smile.slice(1).map((s, i) => (
        <Line.Segment key={s.strike} point1={[smile[i].strike, smile[i].withDemand]} point2={[s.strike, s.withDemand]} color="var(--text)" weight={2.5} />
      ))}
      {smile.map((s) => <Point key={s.strike} x={s.strike} y={s.withDemand} color={s.strike < 100 ? 'var(--c-put)' : 'var(--c-call)'} />)}
    </PlotFrame>
  );

  const dMax = Math.max(...demand.map(Math.abs), 500) * 1.7;
  const bottom = (
    <div style={{ borderTop: '1px solid var(--border)' }}>
      <PlotFrame x={X} y={[-dMax, dMax]} height={130} xTicks={DEMAND_STRIKES} yTicks={niceTicks(-dMax, dMax, 4)} formatX={(v) => `$${v}`} formatY={(v) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toLocaleString('en-US')}`} baseline={0} xLabel="strike (puts below $100, calls from $100)" yLabel="net end-user demand (contracts)" marginLeft={52}>
        {DEMAND_STRIKES.map((K, i) => demand[i] !== 0 && (
          <Polygon key={K} points={[[K - 1.6, 0], [K + 1.6, 0], [K + 1.6, demand[i]], [K - 1.6, demand[i]]]} color={demand[i] > 0 ? 'var(--c-ask)' : 'var(--c-bid)'} fillOpacity={0.6} strokeOpacity={0.9} weight={1} />
        ))}
      </PlotFrame>
    </div>
  );

  return (
    <WidgetFrame
      title={title}
      ariaLabel={`With ${DEMAND_PRESETS[preset].label.toLowerCase()}, the $90 put trades at ${(at(90).withDemand * 100).toFixed(1)}% and the $110 call at ${(at(110).withDemand * 100).toFixed(1)}% implied volatility, against 20% without demand.`}
      plotHeight={350}
      plot={<>{top}{bottom}</>}
      controls={
        <>
          <Select label="End users' net demand" value={preset} onChange={setPreset} options={Object.entries(DEMAND_PRESETS).map(([k, p]) => ({ value: k as Preset, label: p.label }))} />
          <Slider label="Size of the demand" value={scale} min={0} max={2} step={0.1} onChange={setScale} format={(v) => `${v.toFixed(1)}×`} />
          <Slider label="Dealers' risk aversion $\gamma$ (×10⁻⁶)" value={g} min={0} max={4} step={0.25} onChange={setG} format={(v) => v.toFixed(2)} color="var(--c-put)" />
        </>
      }
      readout={
        <dl className="readout-grid">
          <dt>$90 put</dt><dd>{(at(90).withDemand * 100).toFixed(1)}% <span className="muted">premium {at(90).premium >= 0 ? '+' : '−'}{money(Math.abs(at(90).premium * MULTIPLIER))} per contract</span></dd>
          <dt>$110 call</dt><dd>{(at(110).withDemand * 100).toFixed(1)}% <span className="muted">premium {at(110).premium >= 0 ? '+' : '−'}{money(Math.abs(at(110).premium * MULTIPLIER))} per contract</span></dd>
          <dt>Skew</dt><dd>{((at(90).withDemand - at(110).withDemand) * 100).toFixed(1)} vol points <span className="muted">($90 put minus $110 call)</span></dd>
        </dl>
      }
      caption="Three-month options on the \$100 stock, whose hedgeable value is flat at 20% volatility. Dealers absorb the net demand, delta-hedge it, and charge for what they can't hedge: changes in volatility (1.5 points over the horizon) and a 5% chance of a 15% crash. Pink bars: end users buy; blue bars: end users sell."
    />
  );
}
