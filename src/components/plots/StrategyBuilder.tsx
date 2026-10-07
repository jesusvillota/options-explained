import { Line, MovablePoint, Point, Polyline } from 'mafs';
import { useState } from 'react';
import type { Side } from '../../lib/pricing/payoff';
import {
  breakevens, kinks, legPayoffAt, legProfitAt, makeLeg, netCost, PRESETS, profitRange, strategyPayoff, strategyProfit,
  type LegKind, type StrategyLeg,
} from '../../lib/pricing/strategy';
import { Button, Segmented, Select, Slider } from '../ui/controls';
import { WidgetFrame } from '../ui/WidgetFrame';
import { clamp, money, niceTicks, signedMoney } from './format';
import { Label, PlotFrame, Sub } from './PlotFrame';

type Mode = 'payoff' | 'profit';
type PresetKey = keyof typeof PRESETS;
interface EditableLeg extends StrategyLeg {
  id: number;
}

interface StrategyBuilderProps {
  title?: string;
  caption?: string;
  preset?: PresetKey;
  /** Show the preset picker. */
  presetPicker?: boolean;
  /** Let the reader add, remove and change legs. */
  editable?: boolean;
  mode?: Mode;
  initialSpot?: number;
}

const X: [number, number] = [50, 150];
const HEIGHT = 340;
const MAX_LEGS = 5;
const K_RANGE: [number, number] = [60, 140];
const LEG_COLOR: Record<LegKind, string> = { call: 'var(--c-call)', put: 'var(--c-put)', stock: 'var(--c-spot)' };

let nextId = 1;
const withIds = (legs: StrategyLeg[]): EditableLeg[] => legs.map((l) => ({ ...l, id: nextId++ }));

/**
 * Chapter 5: snap options (and stock) together and see the combined payoff or
 * profit at expiry. Each leg is ghosted behind the total, so the reader sees
 * the sum being formed.
 */
export default function StrategyBuilder({
  title = 'Strategy builder',
  caption,
  preset: initialPreset = 'long-straddle',
  presetPicker = true,
  editable = true,
  mode: initialMode = 'profit',
  initialSpot = 120,
}: StrategyBuilderProps) {
  const [preset, setPreset] = useState<PresetKey | 'custom'>(initialPreset);
  const [legs, setLegs] = useState<EditableLeg[]>(() => withIds(PRESETS[initialPreset].legs()));
  const [mode, setMode] = useState<Mode>(initialMode);
  const [spot, setSpot] = useState(initialSpot);

  const choosePreset = (key: PresetKey | 'custom') => {
    if (key === 'custom') return;
    setPreset(key);
    setLegs(withIds(PRESETS[key].legs()));
  };
  const updateLeg = (id: number, change: Partial<Pick<StrategyLeg, 'kind' | 'side' | 'strike' | 'quantity'>>) => {
    setPreset('custom');
    setLegs((ls) =>
      ls.map((l) => {
        if (l.id !== id) return l;
        const next = { ...l, ...change };
        return { ...makeLeg(next.kind, next.side, next.strike, next.quantity), id };
      }),
    );
  };
  const removeLeg = (id: number) => {
    setPreset('custom');
    setLegs((ls) => ls.filter((l) => l.id !== id));
  };
  const addLeg = () => {
    setPreset('custom');
    setLegs((ls) => [...ls, { ...makeLeg('call', 'long', 100), id: nextId++ }]);
  };

  const total = (s: number) => (mode === 'profit' ? strategyProfit(legs, s) : strategyPayoff(legs, s));
  const legLine = (leg: StrategyLeg, s: number) => (mode === 'profit' ? legProfitAt(leg, s) : legPayoffAt(leg, s));
  const xs = [X[0], ...kinks(legs).filter((k) => k > X[0] && k < X[1]), X[1]];

  // Fit the y-axis to everything drawn, with some breathing room.
  const allYs = [0, ...xs.map(total), ...legs.flatMap((l) => [X[0], l.strike, X[1]].map((s) => legLine(l, s)))];
  const lo = Math.min(...allYs);
  const hi = Math.max(...allYs);
  const pad = Math.max((hi - lo) * 0.1, 4);
  const yTicks = niceTicks(lo - pad, hi + pad, 5);
  const Y: [number, number] = [Math.min(lo - pad, yTicks[0]), Math.max(hi + pad, yTicks[yTicks.length - 1])];

  const cost = netCost(legs);
  const range = profitRange(legs);
  const bes = breakevens(legs);
  const yAt = total(spot);
  const strikes = kinks(legs);
  const slope = total(spot + 0.5) - total(spot - 0.5);

  const plot = (
    <PlotFrame
      x={X}
      y={Y}
      height={HEIGHT}
      xTicks={[50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150]}
      yTicks={yTicks}
      formatX={(v) => `$${v}`}
      formatY={(v) => (v > 0 ? `+${v}` : v < 0 ? `−${-v}` : '0')}
      baseline={0}
      xLabel={<>stock price at expiry <Sub base="S" sub="T" /></>}
      yLabel={mode === 'profit' ? 'profit ($ per share)' : 'payoff ($ per share)'}
    >
      {strikes.map((k) => (
        <Line.Segment key={`k${k}`} point1={[k, Y[0]]} point2={[k, Y[1]]} color="var(--c-strike)" style="dashed" weight={1} opacity={0.45} />
      ))}
      {legs.map((leg) => (
        <Polyline
          key={leg.id}
          points={(leg.kind === 'stock' ? [X[0], X[1]] : [X[0], leg.strike, X[1]]).map((s) => [s, legLine(leg, s)] as [number, number])}
          color={LEG_COLOR[leg.kind]}
          weight={2}
          strokeOpacity={0.5}
          strokeStyle="dashed"
          fillOpacity={0}
        />
      ))}
      <Polyline points={xs.map((s) => [s, total(s)] as [number, number])} color="var(--text)" weight={4} fillOpacity={0} />
      {mode === 'profit' &&
        bes.filter((b) => b > X[0] && b < X[1]).map((b, i) => (
          <g key={`be${i}`}>
            <Point x={b} y={0} color="var(--text)" />
            <Label x={b} y={0} attach={i % 2 === 0 ? 'sw' : 'se'} attachDistance={8} size={12} color="var(--text)">
              ${b.toFixed(2)}
            </Label>
          </g>
        ))}
      <Line.Segment point1={[spot, 0]} point2={[spot, yAt]} color="var(--c-spot)" style="dashed" weight={1.5} />
      <Label x={spot} y={yAt} attach={slope > 0.1 ? 'nw' : slope < -0.1 ? 'ne' : 'n'} attachDistance={16} size={13} color="var(--c-spot)">
        {signedMoney(yAt)}
      </Label>
      <MovablePoint
        point={[spot, yAt]}
        color="var(--c-spot)"
        onMove={([x]) => setSpot(Math.round(clamp(x, ...X)))}
        constrain={([x]) => {
          const s = clamp(x, ...X);
          return [s, total(s)];
        }}
      />
    </PlotFrame>
  );

  const controls = (
    <div className="strategy-controls">
      <div className="widget-controls">
        {presetPicker && (
          <Select
            label="Strategy"
            value={preset}
            onChange={choosePreset}
            options={[
              ...(Object.keys(PRESETS) as PresetKey[]).map((k) => ({ value: k, label: PRESETS[k].name })),
              ...(preset === 'custom' ? [{ value: 'custom' as const, label: 'Custom' }] : []),
            ]}
          />
        )}
        <Segmented label="Show" value={mode} onChange={setMode} options={[
          { value: 'payoff', label: 'Payoff' },
          { value: 'profit', label: 'Profit' },
        ]} />
        <Slider label="Stock price at expiry $\Spot{S_T}$" value={spot} min={X[0]} max={X[1]} onChange={setSpot} format={(v) => `$${v}`} color="var(--c-spot)" />
      </div>
      <ol className="legs" aria-label="Legs of the strategy">
        {legs.map((leg, i) => (
          <li key={leg.id} className="leg" style={{ ['--leg' as string]: LEG_COLOR[leg.kind] }}>
            <span className="leg-name">
              Leg {i + 1}: {leg.side === 'long' ? 'buy' : 'sell'} {leg.quantity} {leg.kind === 'stock' ? (leg.quantity > 1 ? 'shares' : 'share') : `${leg.kind}${leg.quantity > 1 ? 's' : ''}`}
              {leg.kind !== 'stock' && <> · strike ${leg.strike}</>} @ {money(leg.premium)}
            </span>
            {editable && (
              <div className="leg-edit">
                <Segmented label={`Leg ${i + 1} side`} value={leg.side} onChange={(side: Side) => updateLeg(leg.id, { side })} options={[
                  { value: 'long', label: 'Buy' },
                  { value: 'short', label: 'Sell' },
                ]} />
                <Segmented label={`Leg ${i + 1} instrument`} value={leg.kind} onChange={(kind: LegKind) => updateLeg(leg.id, { kind })} options={[
                  { value: 'call', label: 'Call', color: 'var(--c-call)' },
                  { value: 'put', label: 'Put', color: 'var(--c-put)' },
                  { value: 'stock', label: 'Stock', color: 'var(--c-spot)' },
                ]} />
                <div className="leg-qty" role="group" aria-label={`Leg ${i + 1} quantity`}>
                  <button type="button" className="ctl-button" aria-label="One fewer" onClick={() => updateLeg(leg.id, { quantity: Math.max(1, leg.quantity - 1) })} disabled={leg.quantity <= 1}>−</button>
                  <span className="num">×{leg.quantity}</span>
                  <button type="button" className="ctl-button" aria-label="One more" onClick={() => updateLeg(leg.id, { quantity: Math.min(3, leg.quantity + 1) })} disabled={leg.quantity >= 3}>+</button>
                </div>
                {leg.kind !== 'stock' && (
                  <Slider label="Strike $\Strike{K}$" value={leg.strike} min={K_RANGE[0]} max={K_RANGE[1]} step={5} onChange={(strike) => updateLeg(leg.id, { strike })} format={(v) => `$${v}`} color="var(--c-strike)" />
                )}
                <button type="button" className="ctl-button leg-remove" aria-label={`Remove leg ${i + 1}`} onClick={() => removeLeg(leg.id)} disabled={legs.length <= 1}>Remove</button>
              </div>
            )}
          </li>
        ))}
      </ol>
      {editable && legs.length < MAX_LEGS && <Button onClick={addLeg}>+ Add a leg</Button>}
    </div>
  );

  const fmtRange = (v: number) => (v === Infinity ? 'unlimited' : v === -Infinity ? 'unlimited loss' : signedMoney(v));
  const readout = (
    <>
      {preset !== 'custom' && (
        <p>
          <strong>{PRESETS[preset].name}.</strong> <span className="muted">{PRESETS[preset].view}</span>
        </p>
      )}
      <dl className="readout-grid" style={{ marginTop: '0.5rem' }}>
        <dt>Net cost today</dt>
        <dd>{Math.abs(cost) < 0.005 ? '$0.00' : cost > 0 ? `${money(cost)} paid (a debit)` : `${money(cost)} received (a credit)`}</dd>
        <dt>Best case</dt>
        <dd className={range.maxProfit > 0 ? 'good' : undefined}>{fmtRange(range.maxProfit)}</dd>
        <dt>Worst case</dt>
        <dd className={range.minProfit < 0 ? 'bad' : undefined}>{fmtRange(range.minProfit)}</dd>
        <dt>Breakeven{bes.length === 1 ? '' : 's'}</dt>
        <dd>{bes.length ? bes.map((b) => `$${b.toFixed(2)}`).join(' and ') : 'none'}</dd>
        <dt>At <span className="num">${spot}</span></dt>
        <dd>profit {signedMoney(strategyProfit(legs, spot))}</dd>
      </dl>
    </>
  );

  return (
    <WidgetFrame
      title={title}
      ariaLabel={`${mode} at expiry of a ${legs.length}-leg strategy with kinks at ${strikes.map((k) => `$${k}`).join(', ') || 'no strikes'}. Breakevens: ${bes.map((b) => `$${b.toFixed(2)}`).join(', ') || 'none'}.`}
      plotHeight={HEIGHT}
      plot={plot}
      controls={controls}
      readout={readout}
      caption={caption ?? 'Thick line: the whole strategy. Dashed lines: its legs (green calls, red puts, blue stock). Amounts are per share; multiply by 100 for one contract.'}
    />
  );
}
