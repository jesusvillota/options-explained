import { Line, MovablePoint, Point } from 'mafs';
import { useMemo, useState } from 'react';
import { optionChain } from '../../lib/market/optionChain';
import { DEFAULTS } from '../../lib/pricing/blackScholes';
import { parityValue } from '../../lib/pricing/parity';
import { forwardPrice } from '../../lib/pricing/rates';
import { Slider } from '../ui/controls';
import { WidgetFrame } from '../ui/WidgetFrame';
import { clamp, money, signedMoney } from './format';
import { Label, PlotFrame } from './PlotFrame';

const STRIKES = [80, 85, 90, 95, 100, 105, 110, 115, 120];
const X: [number, number] = [76, 124];
const Y: [number, number] = [-30, 35];
const HEIGHT = 330;
const QUOTE_K = 110;

/**
 * Chapter 8: put–call parity as a straight line. Across strikes, C − P must
 * equal S e^{−qT} − K e^{−rT}: a line with slope −e^{−rT} that crosses zero at
 * the forward price. Market quotes (with their bid–ask ranges) sit on it;
 * drag the extra quote off it to see the conversion or reversal.
 */
export default function ParityLine() {
  const [r, setR] = useState(DEFAULTS.r);
  const [q, setQ] = useState(0);
  const [T, setT] = useState(1);
  const [offset, setOffset] = useState(4);
  const S = DEFAULTS.S;
  const chain = useMemo(() => optionChain({ ...DEFAULTS, r, q, T, strikes: STRIKES, seed: 5 }), [r, q, T]);
  const line = (K: number) => parityValue({ S, K, r, q, T });
  const F = forwardPrice({ S, r, q, T });
  const quoteY = line(QUOTE_K) + offset;
  const gap = offset;
  const pv = (K: number) => K * Math.exp(-r * T);
  // With dividends reinvested, e^{−qT} shares today grow into exactly 1 share at expiry.
  const shares = Math.exp(-q * T);
  const shareText = q > 0 ? `${shares.toFixed(4)} shares (${money(S * shares)}, dividends reinvested)` : `1 share (${money(S)})`;

  const plot = (
    <PlotFrame
      x={X}
      y={Y}
      height={HEIGHT}
      xTicks={[80, 90, 100, 110, 120]}
      yTicks={[-30, -20, -10, 0, 10, 20, 30]}
      formatX={(v) => `$${v}`}
      formatY={(v) => (v > 0 ? `+${v}` : v < 0 ? `−${-v}` : '0')}
      baseline={0}
      xLabel="strike K"
      yLabel="call price − put price"
    >
      <Line.Segment point1={[X[0], line(X[0])]} point2={[X[1], line(X[1])]} color="var(--c-strike)" weight={3} />
      {F > X[0] && F < X[1] && (
        <>
          <Point x={F} y={0} color="var(--c-rate)" />
          <Label x={F} y={0} attach="sw" attachDistance={8} size={12} color="var(--c-rate)">C = P at the forward ${F.toFixed(2)}</Label>
        </>
      )}
      {chain.map((row) => {
        const hi = row.call.ask - row.put.bid;
        const lo = row.call.bid - row.put.ask;
        const mid = (hi + lo) / 2;
        return (
          <g key={row.strike}>
            <Line.Segment point1={[row.strike, lo]} point2={[row.strike, hi]} color="var(--text-muted)" weight={7} opacity={0.6} />
            <Point x={row.strike} y={mid} color="var(--text)" />
          </g>
        );
      })}
      <Line.Segment point1={[QUOTE_K, line(QUOTE_K)]} point2={[QUOTE_K, quoteY]} color="var(--c-spot)" style="dashed" weight={1.5} />
      <Label x={QUOTE_K} y={quoteY} attach={offset >= 0 ? 'ne' : 'se'} attachDistance={12} size={12} color="var(--c-spot)">
        your quote: gap {signedMoney(gap)}
      </Label>
      <MovablePoint
        point={[QUOTE_K, quoteY]}
        color="var(--c-spot)"
        onMove={([, y]) => setOffset(Math.round(clamp(y - line(QUOTE_K), -15, 15) * 4) / 4)}
        constrain={([, y]) => [QUOTE_K, clamp(y, line(QUOTE_K) - 15, line(QUOTE_K) + 15)]}
      />
    </PlotFrame>
  );

  const rows =
    gap > 0
      ? [
          ['Today', `Sell the call, buy the put, buy ${shareText}, borrow ${money(pv(QUOTE_K))}.`, `+${money(gap)}`],
          ['At expiry', `Either the call is exercised or you exercise the put: the share goes for $${QUOTE_K}, which repays the loan.`, '$0'],
        ]
      : gap < 0
        ? [
            ['Today', `Buy the call, sell the put, short ${shareText}, lend ${money(pv(QUOTE_K))}.`, `+${money(-gap)}`],
            ['At expiry', `The loan returns $${QUOTE_K}; you buy the share back for $${QUOTE_K} through the call or the put.`, '$0'],
          ]
        : null;

  return (
    <WidgetFrame
      title="Put–call parity is a straight line"
      ariaLabel={`Call minus put prices across strikes lie on a line crossing zero at the forward price $${F.toFixed(2)}. Your quote at strike $${QUOTE_K} is ${gap === 0 ? 'on' : 'off'} the line by ${money(Math.abs(gap))}.`}
      plotHeight={HEIGHT}
      plot={plot}
      controls={
        <>
          <Slider label="Interest rate $\Rate{r}$" value={r} min={0} max={0.12} step={0.005} onChange={setR} format={(v) => `${(v * 100).toFixed(1)}%`} color="var(--c-rate)" />
          <Slider label="Dividend yield $q$" value={q} min={0} max={0.08} step={0.005} onChange={setQ} format={(v) => `${(v * 100).toFixed(1)}%`} color="var(--text-muted)" />
          <Slider label="Time to expiry $\Time{T}$" value={T} min={0.1} max={2} step={0.05} onChange={setT} format={(v) => `${v.toFixed(2)} yr`} color="var(--c-time)" />
        </>
      }
      readout={
        rows ? (
          <>
            <p><strong>{gap > 0 ? 'Calls too rich vs puts: a conversion.' : 'Calls too cheap vs puts: a reversal.'}</strong></p>
            <dl className="readout-grid" style={{ marginTop: '0.4rem' }}>
              {rows.map(([when, what, cash]) => (
                <div key={when} style={{ display: 'contents' }}>
                  <dt>{when}</dt>
                  <dd style={{ fontWeight: 400 }}>{what} <strong className={cash === '$0' ? '' : 'good'}>Net: {cash}</strong></dd>
                </div>
              ))}
            </dl>
          </>
        ) : (
          <p><strong>On the line.</strong> Your quote satisfies parity: no riskless trade.</p>
        )
      }
      caption={'Yellow line: parity, $\\Call{C} - \\Put{P} = \\Spot{S}e^{-q\\Time{T}} - \\Strike{K}e^{-\\Rate{r}\\Time{T}}$. White dots: mid-market quotes from the chain; the short grey bars around them span what you could actually trade C − P for after the bid–ask spread. Drag the blue quote.'}
    />
  );
}
