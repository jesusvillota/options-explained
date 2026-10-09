import { Polygon } from 'mafs';
import { useMemo, useState } from 'react';
import { MARGIN_POSITIONS, positionValue, scaledGrid, scenarioMargin, strategyMargin } from '../../lib/micro/margin';
import { Select, Slider } from '../ui/controls';
import { WidgetFrame } from '../ui/WidgetFrame';
import { useMediaQuery } from './animation';
import { money, signedMoney } from './format';
import { Label, PlotFrame } from './PlotFrame';

type Key = keyof typeof MARGIN_POSITIONS;
const HEIGHT = 300;
const CALM = { S: 100, T: 0.25, r: 0.05, sigma: 0.2, q: 0 };

interface MarginScenariosProps {
  title?: string;
  initialPosition?: Key;
  initialVol?: number;
  initialSpot?: number;
}

/**
 * Chapter 46: a position's risk array. Each cell is the position's profit or
 * loss if the stock moved by that much and volatility shifted by that much; the
 * risk-based margin is the worst cell. The grid widens with volatility, so
 * margin rises when markets get turbulent.
 */
export default function MarginScenarios({ title = 'Risk-based margin', initialPosition = 'shortPut', initialVol = 0.2, initialSpot = 100 }: MarginScenariosProps) {
  const [key, setKey] = useState<Key>(initialPosition);
  const [sigma, setSigma] = useState(initialVol);
  const [S, setS] = useState(initialSpot);
  const compact = useMediaQuery('(max-width: 600px)');
  const legs = MARGIN_POSITIONS[key].legs;
  const market = { ...CALM, S, sigma };
  const grid = useMemo(() => scaledGrid(sigma), [sigma]);
  const res = useMemo(() => scenarioMargin(legs, market, grid), [key, sigma, S]);
  const strat = strategyMargin(legs, market);
  const value = positionValue(legs, market);
  const calm = scenarioMargin(legs, CALM).margin;
  const calmValue = positionValue(legs, CALM);

  const a = grid.priceShocks[grid.priceShocks.length - 1] * 100;
  const v = grid.volShocks[grid.volShocks.length - 1] * 100;
  const dx = (2 * a) / (grid.priceShocks.length - 1), dy = (2 * v) / (grid.volShocks.length - 1);
  const maxAbs = Math.max(...res.array.flat().map(Math.abs), 1);
  const xTicks = grid.priceShocks.filter((_, i) => i % 2 === 0).map((p) => Math.round(p * 1000) / 10);
  const yTicks = grid.volShocks.map((s) => Math.round(s * 1000) / 10);

  const plot = (
    <PlotFrame
      x={[-a - dx / 2, a + dx / 2]}
      y={[-v - dy / 2, v + dy * 1.1]}
      height={HEIGHT}
      xTicks={xTicks}
      yTicks={yTicks}
      formatX={(t) => `${t > 0 ? '+' : t < 0 ? '−' : ''}${Math.abs(t).toFixed(1)}%`}
      formatY={(t) => `${t > 0 ? '+' : t < 0 ? '−' : ''}${Math.abs(t).toFixed(1)}`}
      xLabel="stock move"
      yLabel="vol shift (points)"
      marginLeft={44}
    >
      {res.array.map((row, j) =>
        row.map((pnl, i) => {
          const cx = grid.priceShocks[i] * 100, cy = grid.volShocks[j] * 100;
          const worst = pnl === res.worst.pnl;
          return (
            <g key={`${i}-${j}`}>
              <Polygon
                points={[[cx - dx / 2, cy - dy / 2], [cx + dx / 2, cy - dy / 2], [cx + dx / 2, cy + dy / 2], [cx - dx / 2, cy + dy / 2]]}
                color="var(--bg-inset)"
                fillOpacity={1}
                strokeOpacity={0}
              />
              <Polygon
                points={[[cx - dx / 2, cy - dy / 2], [cx + dx / 2, cy - dy / 2], [cx + dx / 2, cy + dy / 2], [cx - dx / 2, cy + dy / 2]]}
                color={pnl >= 0 ? 'var(--c-call)' : 'var(--c-put)'}
                fillOpacity={0.08 + 0.72 * (Math.abs(pnl) / maxAbs) ** 0.8}
                strokeOpacity={worst ? 1 : 0.15}
                weight={worst ? 3 : 1}
              />
              {(!compact || worst) && (
                <Label x={cx} y={cy} size={compact ? 10 : 11} color="var(--text)">
                  {Math.round(pnl) === 0 ? '0' : `${pnl < 0 ? '−' : '+'}${Math.round(Math.abs(pnl))}`}
                </Label>
              )}
            </g>
          );
        }),
      )}
    </PlotFrame>
  );

  return (
    <WidgetFrame
      title={title}
      ariaLabel={`Risk array for ${MARGIN_POSITIONS[key].label}: the worst scenario loses ${money(res.margin, 0)}, which is the risk-based margin. Strategy-based margin is ${money(strat, 0)}.`}
      plotHeight={HEIGHT}
      plot={plot}
      controls={
        <>
          <Select label="Position (three-month options, 1 contract each)" value={key} onChange={setKey} options={Object.entries(MARGIN_POSITIONS).map(([k, p]) => ({ value: k as Key, label: p.label }))} />
          <Slider label="Stock today $\Spot{S}$" value={S} min={85} max={115} step={1} onChange={setS} format={(x) => `$${x}`} color="var(--c-spot)" />
          <Slider label="Implied volatility today $\Vol{\sigma}$" value={sigma} min={0.1} max={0.6} step={0.01} onChange={setSigma} format={(x) => `${Math.round(x * 100)}%`} color="var(--c-vol)" />
        </>
      }
      readout={
        <dl className="readout-grid">
          <dt>Position value</dt>
          <dd>{signedMoney(value, 0)} <span className="muted">({Math.abs(value - calmValue) < 0.5 ? 'unchanged' : `${value > calmValue ? 'up' : 'down'} ${money(Math.abs(value - calmValue), 0)}`} since the calm start: S = 100, σ = 20%)</span></dd>
          <dt>Risk-based margin</dt>
          <dd>{money(res.margin, 0)} <span className="muted">worst cell: stock {res.worst.priceShock >= 0 ? '+' : '−'}{Math.abs(res.worst.priceShock * 100).toFixed(1)}%, vol {res.worst.volShock >= 0 ? '+' : '−'}{Math.abs(res.worst.volShock * 100).toFixed(1)} pts</span></dd>
          <dt>Strategy-based margin</dt>
          <dd>{money(strat, 0)} <span className="muted">{strat === 0 ? '(paid in full, nothing more)' : '(fixed rules per position type)'}</span></dd>
          <dt>Since the calm start</dt>
          <dd className={res.margin > calm + 0.5 ? 'bad' : undefined}>
            {Math.abs(res.margin - calm) < 0.5 ? 'margin unchanged' : `margin ${res.margin > calm ? 'up' : 'down'} ${money(Math.abs(res.margin - calm), 0)}`}
            {value < calmValue - 0.5 ? `, plus a ${money(calmValue - value, 0)} loss on the position: about ${money(Math.max(res.margin - calm, 0) + calmValue - value, 0)} of new cash` : ''}
          </dd>
        </dl>
      }
      caption="Each cell is the position's profit or loss, in dollars, if the stock and its implied volatility jumped by that much right now. The grid spans a 99% two-week move, ±2.33σ√(10/252), and volatility shifts of a third of its level, so it widens as volatility rises. Green is a gain, red a loss; the outlined cell is the worst."
    />
  );
}
