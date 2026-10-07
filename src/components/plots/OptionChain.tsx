import { Line, Point, Polyline } from 'mafs';
import { Fragment, useMemo, useState } from 'react';
import { optionChain, type Quote } from '../../lib/market/optionChain';
import { DEFAULTS } from '../../lib/pricing/blackScholes';
import { payoff, type OptionType, type Side } from '../../lib/pricing/payoff';
import { Segmented } from '../ui/controls';
import { RichText } from '../ui/Tex';
import { useMediaQuery } from './animation';
import { count, money, niceTicks, signedMoney } from './format';
import { Label, PlotFrame, Sub } from './PlotFrame';

type Expiry = '1m' | '3m' | '1y';
const EXPIRIES: Record<Expiry, { T: number; label: string; long: string; seed: number }> = {
  '1m': { T: 1 / 12, label: '1 month', long: 'one month', seed: 3 },
  '3m': { T: 0.25, label: '3 months', long: 'three months', seed: 7 },
  '1y': { T: 1, label: '1 year', long: 'one year', seed: 11 },
};
const STRIKES = [80, 85, 90, 95, 100, 105, 110, 115, 120];
const MULTIPLIER = 100;
const X: [number, number] = [70, 130];

interface Selection {
  type: OptionType;
  strike: number;
  side: Side;
}

interface OptionChainProps {
  title?: string;
  caption?: string;
  initialExpiry?: Expiry;
  initialSelection?: Selection;
}

/**
 * Chapter 4: a synthetic option chain for a stock at $100, as a broker would
 * show it. Clicking an ask buys, clicking a bid sells; the panel below shows
 * what that trade costs and its profit at expiry, per contract of 100 shares.
 */
export default function OptionChain({
  title = 'Option chain · stock at $100.00',
  caption,
  initialExpiry = '3m',
  initialSelection = { type: 'call', strike: 105, side: 'long' },
}: OptionChainProps) {
  const [expiry, setExpiry] = useState<Expiry>(initialExpiry);
  const [sel, setSel] = useState<Selection>(initialSelection);
  // On narrow screens, show only bid / strike / ask so the chain fits.
  const compact = useMediaQuery('(max-width: 600px)');
  const sideSpan = compact ? 2 : 4;
  const { T, seed } = EXPIRIES[expiry];
  const chain = useMemo(() => optionChain({ ...DEFAULTS, T, strikes: STRIKES, seed }), [T, seed]);

  const row = chain.find((r) => r.strike === sel.strike)!;
  const quote = row[sel.type];
  const long = sel.side === 'long';
  const premium = long ? quote.ask : quote.bid;
  const cash = premium * MULTIPLIER;
  const profit = (s: number) => MULTIPLIER * (long ? payoff(sel.type, s, sel.strike) - premium : premium - payoff(sel.type, s, sel.strike));
  const be = sel.type === 'call' ? sel.strike + premium : sel.strike - premium;
  const spreadCost = (quote.ask - quote.bid) * MULTIPLIER;
  const color = sel.type === 'call' ? 'var(--c-call)' : 'var(--c-put)';

  // Profit chart range: fit the line over the visible prices, with some room.
  const ys = [X[0], sel.strike, X[1]].map(profit);
  const yLo = Math.min(...ys, 0);
  const yHi = Math.max(...ys, 0);
  const pad = Math.max((yHi - yLo) * 0.12, 50);
  const yTicks = niceTicks(yLo - pad, yHi + pad, 4);
  const Y: [number, number] = [Math.min(yLo - pad, yTicks[0]), Math.max(yHi + pad, yTicks[yTicks.length - 1])];

  const cell = (type: OptionType, strike: number, q: Quote, side: Side) => {
    const price = side === 'long' ? q.ask : q.bid;
    const active = sel.type === type && sel.strike === strike && sel.side === side;
    const verb = side === 'long' ? 'Buy' : 'Sell';
    return (
      <td className={`chain-quote ${q.inTheMoney ? `itm-${type}` : ''} ${active ? 'active' : ''}`}>
        <button
          type="button"
          aria-pressed={active}
          aria-label={`${verb} the $${strike} ${type} at ${price.toFixed(2)}`}
          onClick={() => setSel({ type, strike, side })}
        >
          {price.toFixed(2)}
        </button>
      </td>
    );
  };

  const spotIndex = STRIKES.findIndex((k) => k >= DEFAULTS.S);

  return (
    <figure className="widget chain-widget">
      <figcaption className="widget-title">{title}</figcaption>
      <div className="widget-controls" style={{ marginBottom: '0.7rem' }}>
        <Segmented
          label="Expiry"
          value={expiry}
          onChange={setExpiry}
          options={(Object.keys(EXPIRIES) as Expiry[]).map((e) => ({ value: e, label: EXPIRIES[e].label, color: 'var(--c-time)' }))}
        />
      </div>
      <div className="chain-wrap">
        <table className="chain">
          <thead>
            <tr className="chain-sides">
              <th colSpan={sideSpan} className="calls">Calls</th>
              <th></th>
              <th colSpan={sideSpan} className="puts">Puts</th>
            </tr>
            <tr>
              {!compact && <th>Open int.</th>}
              {!compact && <th>Volume</th>}
              <th>Bid</th>
              <th>Ask</th>
              <th className="strike">Strike</th>
              <th>Bid</th>
              <th>Ask</th>
              {!compact && <th>Volume</th>}
              {!compact && <th>Open int.</th>}
            </tr>
          </thead>
          <tbody>
            {chain.map((r, i) => (
              <Fragment key={r.strike}>
                {i === spotIndex && (
                  <tr className="chain-spot">
                    <td colSpan={2 * sideSpan + 1}>stock price ${DEFAULTS.S.toFixed(2)}</td>
                  </tr>
                )}
                <tr className={sel.strike === r.strike ? 'selected-row' : undefined}>
                  {!compact && <td className={r.call.inTheMoney ? 'itm-call' : undefined}>{count(r.call.openInterest)}</td>}
                  {!compact && <td className={r.call.inTheMoney ? 'itm-call' : undefined}>{count(r.call.volume)}</td>}
                  {cell('call', r.strike, r.call, 'short')}
                  {cell('call', r.strike, r.call, 'long')}
                  <td className="strike">{r.strike}</td>
                  {cell('put', r.strike, r.put, 'short')}
                  {cell('put', r.strike, r.put, 'long')}
                  {!compact && <td className={r.put.inTheMoney ? 'itm-put' : undefined}>{count(r.put.volume)}</td>}
                  {!compact && <td className={r.put.inTheMoney ? 'itm-put' : undefined}>{count(r.put.openInterest)}</td>}
                </tr>
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <div className="chain-detail">
        <div className="widget-plot" role="img" aria-label={`Profit at expiry per contract for ${long ? 'buying' : 'selling'} the $${sel.strike} ${sel.type}: breakeven at $${be.toFixed(2)}.`} style={{ minHeight: 230 }}>
          <PlotFrame
            x={X}
            y={Y}
            height={230}
            xTicks={[70, 80, 90, 100, 110, 120, 130]}
            yTicks={yTicks}
            formatX={(v) => `$${v}`}
            formatY={(v) => (v === 0 ? '0' : `${v > 0 ? '+' : '−'}${count(Math.abs(v))}`)}
            baseline={0}
            marginLeft={58}
            xLabel={<>stock price at expiry <Sub base="S" sub="T" /></>}
            yLabel="profit per contract ($)"
          >
            <Line.Segment point1={[sel.strike, Y[0]]} point2={[sel.strike, Y[1]]} color="var(--c-strike)" style="dashed" weight={1.5} opacity={0.6} />
            <Polyline points={[X[0], sel.strike, X[1]].map((s) => [s, profit(s)] as [number, number])} color={color} weight={3.5} fillOpacity={0} />
            {be > X[0] && be < X[1] && (
              <>
                <Point x={be} y={0} color="var(--text)" />
                <Label x={be} y={0} attach={(sel.type === 'call') === long ? 'se' : 'sw'} attachDistance={8} size={12} color="var(--text)">
                  breakeven ${be.toFixed(2)}
                </Label>
              </>
            )}
          </PlotFrame>
        </div>
        <div className="widget-readout" aria-live="polite">
          <p>
            <strong style={{ color }}>{long ? 'Buy' : 'Sell (write)'} 1 contract</strong> of the ${sel.strike} {sel.type},{' '}
            {EXPIRIES[expiry].long} to expiry, at the {long ? 'ask' : 'bid'}:{' '}
            <span className="num">{premium.toFixed(2)} × {MULTIPLIER} = {money(cash)}</span> {long ? 'paid' : 'received'}.
          </p>
          <p>
            {long ? (
              <>Worst case: lose the <span className="num">{money(cash)}</span>. </>
            ) : sel.type === 'call' ? (
              <>Worst case: <span className="bad">unlimited</span>, since you may have to deliver 100 shares at ${sel.strike} however high the stock goes. </>
            ) : (
              <>Worst case: buying 100 shares at ${sel.strike} that are worth nothing, a loss of <span className="num bad">{money(sel.strike * MULTIPLIER - cash)}</span>. </>
            )}
            Breakeven at expiry: <span className="num">${be.toFixed(2)}</span>.
          </p>
          <p className="muted">
            Undo the trade straight away and you'd {long ? 'sell at the bid' : 'buy back at the ask'}, losing the spread:{' '}
            <span className="num">{signedMoney(-spreadCost)}</span>. Open interest in this option: {count(quote.openInterest)} contracts (
            {count(quote.openInterest * MULTIPLIER)} shares); traded today: {count(quote.volume)}.
          </p>
        </div>
      </div>
      <p className="widget-caption">
        <RichText>{caption ?? 'Click an ask to buy or a bid to sell. Shaded cells are in the money. Prices are per share; one contract is 100 shares.'}</RichText>
      </p>
    </figure>
  );
}
