import { Line, MovablePoint, Point, Polyline } from 'mafs';
import { Fragment, useState } from 'react';
import { forwardArbitrage, forwardPrice } from '../../lib/pricing/rates';
import { Slider } from '../ui/controls';
import { WidgetFrame } from '../ui/WidgetFrame';
import { clamp, money } from './format';
import { Label, PlotFrame } from './PlotFrame';

const S = 100;
const X: [number, number] = [85, 130];
const HEIGHT = 280;

/**
 * Chapter 6: drag the forward price the market is quoting. Anywhere but the
 * fair price F = S e^{(r−q)T}, a riskless trade appears; its profit grows with
 * the mispricing (the V).
 */
export default function ForwardArbitrageMachine({ initialMarket = 110 }: { initialMarket?: number }) {
  const [market, setMarket] = useState(initialMarket);
  const [r, setR] = useState(0.05);
  const [q, setQ] = useState(0);
  const [T, setT] = useState(1);
  const input = { S, r, q, T };
  const fair = forwardPrice(input);
  const arb = forwardArbitrage(input, market, 0.005);
  const shares = Math.exp(-q * T);
  const cost = S * shares;

  const plot = (
    <PlotFrame
      x={X}
      y={[-2, 30]}
      height={HEIGHT}
      xTicks={[85, 90, 95, 100, 105, 110, 115, 120, 125, 130]}
      yTicks={[0, 10, 20, 30]}
      formatX={(v) => `$${v}`}
      formatY={(v) => `$${v}`}
      baseline={0}
      xLabel="forward price quoted by the market"
      yLabel="riskless profit at delivery"
    >
      <Polyline points={[[X[0], fair - X[0]], [fair, 0], [X[1], X[1] - fair]]} color="var(--text-muted)" weight={2} fillOpacity={0} />
      <Line.Segment point1={[fair, -2]} point2={[fair, 30]} color="var(--c-rate)" style="dashed" weight={1.5} />
      <Label x={fair} y={28} attach="e" attachDistance={6} size={12} color="var(--c-rate)">
        fair F = {money(fair)}
      </Label>
      <Point x={market} y={Math.abs(market - fair)} color="var(--text)" />
      <Label x={market} y={Math.abs(market - fair)} attach={market > fair ? 'nw' : 'ne'} attachDistance={10} size={12} color="var(--text)">
        profit {money(Math.abs(market - fair))}
      </Label>
      <MovablePoint point={[market, 0]} color="var(--c-spot)" onMove={([x]) => setMarket(Math.round(clamp(x, ...X) * 2) / 2)} constrain={([x]) => [clamp(x, ...X), 0]} />
    </PlotFrame>
  );

  const rows =
    arb.kind === 'cash-and-carry'
      ? [
          ['Today', `Borrow ${money(cost)} and buy ${shares.toFixed(4)} shares; agree to sell 1 share at ${money(market)}.`, '$0'],
          ['At delivery', `Hand over the 1 share (dividends reinvested), receive ${money(market)}, repay ${money(fair)}.`, `+${money(market - fair)}`],
        ]
      : arb.kind === 'reverse'
        ? [
            ['Today', `Short ${shares.toFixed(4)} shares, lend the ${money(cost)}; agree to buy 1 share at ${money(market)}.`, '$0'],
            ['At delivery', `Collect ${money(fair)} from the loan, pay ${money(market)} for the share, return it.`, `+${money(fair - market)}`],
          ]
        : null;

  return (
    <WidgetFrame
      title="The arbitrage machine"
      ariaLabel={`Fair forward price ${money(fair)}; the market quotes ${money(market)}, a riskless profit of ${money(Math.abs(market - fair))}.`}
      plotHeight={HEIGHT}
      plot={plot}
      controls={
        <>
          <Slider label="Market's forward price" value={market} min={X[0]} max={X[1]} step={0.5} onChange={setMarket} format={(v) => money(v)} color="var(--c-spot)" />
          <Slider label="Interest rate $\Rate{r}$" value={r} min={0} max={0.15} step={0.005} onChange={setR} format={(v) => `${(v * 100).toFixed(1)}%`} color="var(--c-rate)" />
          <Slider label="Dividend yield $q$" value={q} min={0} max={0.1} step={0.005} onChange={setQ} format={(v) => `${(v * 100).toFixed(1)}%`} color="var(--text-muted)" />
          <Slider label="Time to delivery $\Time{T}$" value={T} min={0.25} max={3} step={0.25} onChange={setT} format={(v) => `${v} yr`} color="var(--c-time)" />
        </>
      }
      readout={
        rows ? (
          <>
            <p>
              <strong>{arb.kind === 'cash-and-carry' ? 'Forward too expensive: cash and carry.' : 'Forward too cheap: reverse cash and carry.'}</strong>
            </p>
            <dl className="readout-grid" style={{ marginTop: '0.4rem' }}>
              {rows.map(([when, what, cash]) => (
                <Fragment key={when}>
                  <dt>{when}</dt>
                  <dd style={{ fontWeight: 400 }}>{what} <strong className={cash === '$0' ? '' : 'good'}>Net: {cash}</strong></dd>
                </Fragment>
              ))}
            </dl>
          </>
        ) : (
          <p><strong>Fair price.</strong> Neither trade makes money: this is the only forward price without a free lunch.</p>
        )
      }
      caption="Drag the blue point to change the forward price quoted in the market. Every trade starts with zero cash and ends with a known profit."
    />
  );
}
