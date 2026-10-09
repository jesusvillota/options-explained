import { Line, Point, Polyline } from 'mafs';
import { Fragment, useState } from 'react';
import { rebalanceTrade } from '../../lib/feedback/spirals';
import { Segmented, Slider } from '../ui/controls';
import { WidgetFrame } from '../ui/WidgetFrame';
import { niceTicks } from './format';
import { Label, PlotFrame } from './PlotFrame';

type Market = 'equity' | 'vix';
const MARKETS: Record<Market, { label: string; range: number; products: { name: string; L: number; aum: number; color: string }[]; underlying: string }> = {
  equity: {
    label: 'Equity index',
    range: 0.1,
    underlying: 'the index',
    products: [
      { name: '3× long', L: 3, aum: 5e9, color: 'var(--c-call)' },
      { name: '2× long', L: 2, aum: 10e9, color: 'var(--c-call)' },
      { name: '−1× inverse', L: -1, aum: 5e9, color: 'var(--c-put)' },
      { name: '−2× inverse', L: -2, aum: 2e9, color: 'var(--c-put)' },
    ],
  },
  vix: {
    label: 'VIX futures',
    range: 1,
    underlying: 'VIX futures',
    products: [
      { name: '−1× inverse VIX', L: -1, aum: 2e9, color: 'var(--c-put)' },
      { name: '2× long VIX', L: 2, aum: 1e9, color: 'var(--c-call)' },
    ],
  },
};

const billions = (v: number) => `${v < 0 ? '−' : v > 0 ? '+' : ''}$${Math.abs(v / 1e9).toFixed(2)}B`;
const short = (L: number) => `${L < 0 ? '−' : ''}${Math.abs(L)}×`;
const pct = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v * 100).toFixed(0)}%`;

interface LeveragedRebalanceProps {
  title?: string;
}

/**
 * Chapter 69: the end-of-day trade that daily-rebalanced leveraged and inverse
 * products must make, L(L − 1) r per dollar of assets. Every one of them
 * trades in the direction of the day's move.
 */
export default function LeveragedRebalance({ title = 'Rebalancing into the close' }: LeveragedRebalanceProps) {
  const [market, setMarket] = useState<Market>('equity');
  const [r, setR] = useState(-0.05);
  const cfg = MARKETS[market];
  const R = cfg.range;
  const ret = Math.max(-R, Math.min(R, r));
  const yMax = Math.max(...cfg.products.map((p) => Math.abs(p.L * (p.L - 1)) * R)) * 1.1;
  const xs = [-R, R];
  // Products with the same L(L − 1) rebalance identically: 3× and −2× (6r), 2× and −1× (2r).
  const groups: { k: number; names: string[]; color: string }[] = [];
  for (const p of cfg.products) {
    const k = p.L * (p.L - 1), g = groups.find((x) => x.k === k);
    if (g) g.names.push(short(p.L));
    else groups.push({ k, names: [short(p.L)], color: groups.length === 0 ? 'var(--c-vol)' : 'var(--c-spot)' });
  }

  const plot = (
    <PlotFrame x={[-R, R]} y={[-yMax, yMax]} height={260} xTicks={niceTicks(-R, R, 4)} yTicks={niceTicks(-yMax, yMax, 4)} formatX={pct} formatY={pct} xLabel={`the day's return of ${cfg.underlying}`} yLabel="trade at the close (share of assets)" baseline={0} marginLeft={52}>
      <Line.Segment point1={[0, -yMax]} point2={[0, yMax]} color="var(--axis)" weight={1} />
      {groups.map((g) => (
        <Fragment key={g.k}>
          <Polyline points={xs.map((x) => [x, g.k * x] as [number, number])} color={g.color} weight={2.5} fillOpacity={0} />
          <Point x={ret} y={g.k * ret} color={g.color} />
          <Label x={R * 0.5} y={g.k * R * 0.5} attach="se" attachDistance={6} size={11} color={g.color}>{`${g.names.join(' and ')}: ${g.k}r`}</Label>
        </Fragment>
      ))}
    </PlotFrame>
  );

  const flows = cfg.products.map((p) => ({ ...p, trade: rebalanceTrade(p.L, ret, p.aum) }));
  const total = flows.reduce((a, f) => a + f.trade, 0);
  return (
    <WidgetFrame
      title={title}
      ariaLabel={`After a ${pct(ret)} day, the products must ${total < 0 ? 'sell' : 'buy'} ${billions(Math.abs(total))} of ${cfg.underlying} at the close.`}
      plotHeight={260}
      plot={plot}
      controls={
        <>
          <Segmented label="Market" value={market} onChange={(v) => { setMarket(v); setR(v === 'vix' ? 0.8 : -0.05); }} options={[{ value: 'equity', label: 'Equity index' }, { value: 'vix', label: 'VIX futures' }]} />
          <Slider label="The day's return" value={ret} min={-R} max={R} step={R / 100} onChange={setR} format={pct} />
        </>
      }
      readout={
        <dl className="readout-grid">
          {flows.map((f) => (
            <Fragment key={f.name}><dt>{f.name} <span className="muted">({billions(f.aum).replace('+', '')})</span></dt><dd>{billions(f.trade)}</dd></Fragment>
          ))}
          <dt>All together</dt><dd><strong>{billions(total)}</strong> <span className="muted">{total < 0 ? 'sold' : 'bought'} at the close, the same way as the day's move</span></dd>
        </dl>
      }
      caption={`Products that promise L times the daily return of ${cfg.underlying} must reset their exposure every evening. After a return r, a product with assets A trades L(L − 1)·r·A: buying after up days and selling after down days, whether it is leveraged or inverse. Assets are illustrative.`}
    />
  );
}
