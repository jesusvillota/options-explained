import { Line, Point } from 'mafs';
import { useMemo, useState } from 'react';
import { STRATEGIES, complexQuote, impliedFromLegs, leggingRiskSd, quoteLegs } from '../../lib/micro/packages';
import { Select, Slider } from '../ui/controls';
import { WidgetFrame } from '../ui/WidgetFrame';
import { money, niceTicks } from './format';
import { Label, PlotFrame } from './PlotFrame';

const HEIGHT = 200;
const MULTIPLIER = 100;
const fmtQty = (q: number) => (q > 0 ? (q === 1 ? 'Buy' : `Buy ${q}×`) : q === -1 ? 'Sell' : `Sell ${-q}×`);

interface SpreadFromLegsProps {
  title?: string;
  initialStrategy?: keyof typeof STRATEGIES;
}

/**
 * Chapter 45: a strategy's market built leg by leg from the exchange quotes,
 * against a market maker's quote for the whole package. The package's own
 * market is tighter when its legs offset each other's risk.
 */
export default function SpreadFromLegs({ title = 'A spread from its legs, or as one package', initialStrategy = 'bullCall' }: SpreadFromLegsProps) {
  const [key, setKey] = useState<keyof typeof STRATEGIES>(initialStrategy);
  const [minutes, setMinutes] = useState(5);
  const legs = useMemo(() => quoteLegs(STRATEGIES[key].legs), [key]);
  const fromLegs = impliedFromLegs(legs);
  const cx = complexQuote(legs);
  const risk = leggingRiskSd(legs, minutes);
  const saving = ((fromLegs.ask - cx.ask) * MULTIPLIER);

  const lo = Math.min(fromLegs.bid, cx.bid), hi = Math.max(fromLegs.ask, cx.ask);
  const pad = Math.max((hi - lo) * 0.18, 0.05);
  const xTicks = niceTicks(lo - pad, hi + pad, 5);
  const X: [number, number] = [Math.min(lo - pad, xTicks[0]), Math.max(hi + pad, xTicks[xTicks.length - 1])];
  const digits = xTicks.length > 1 && xTicks[1] - xTicks[0] < 0.1 ? 2 : 1;

  const row = (y: number, b: number, a: number, label: string) => (
    <>
      <Line.Segment point1={[b, y]} point2={[a, y]} color="var(--text-muted)" weight={6} opacity={0.35} />
      <Point x={b} y={y} color="var(--c-bid)" />
      <Point x={a} y={y} color="var(--c-ask)" />
      <Label x={b} y={y} attach="sw" attachDistance={7} size={12} color="var(--c-bid)">{b.toFixed(2)}</Label>
      <Label x={a} y={y} attach="se" attachDistance={7} size={12} color="var(--c-ask)">{a.toFixed(2)}</Label>
      <Label x={X[0]} y={y + 0.3} attach="e" attachDistance={4} size={12} color="var(--text)">{label}</Label>
    </>
  );

  const plot = (
    <PlotFrame x={X} y={[0.3, 2.85]} height={HEIGHT} xTicks={xTicks} yTicks={[]} formatX={(v) => v.toFixed(digits)} xLabel="package price ($ per share)" marginLeft={14}>
      {row(2, fromLegs.bid, fromLegs.ask, `Leg by leg: ${(fromLegs.ask - fromLegs.bid).toFixed(2)} wide`)}
      {row(1, cx.bid, cx.ask, `Package quote: ${(cx.ask - cx.bid).toFixed(2)} wide`)}
      <Line.Segment point1={[cx.theo, 0.45]} point2={[cx.theo, 2.75]} color="var(--text)" style="dashed" weight={1.2} />
      <Label x={cx.theo} y={0.45} attach="e" attachDistance={4} size={11} color="var(--text-muted)">{`value ${cx.theo.toFixed(3)}`}</Label>
    </PlotFrame>
  );

  return (
    <WidgetFrame
      title={title}
      ariaLabel={`${STRATEGIES[key].label}: from the legs the market is ${fromLegs.bid.toFixed(2)} bid, ${fromLegs.ask.toFixed(2)} offered; as a package ${cx.bid.toFixed(2)} / ${cx.ask.toFixed(2)}.`}
      plotHeight={HEIGHT}
      plot={plot}
      controls={
        <>
          <Select label="Strategy (three-month options, stock at $100)" value={key} onChange={setKey} options={Object.entries(STRATEGIES).map(([k, s]) => ({ value: k as keyof typeof STRATEGIES, label: s.label }))} />
          <Slider label="Delay between legs" value={minutes} min={0} max={30} step={1} onChange={setMinutes} format={(v) => (v === 0 ? 'none' : `${v} min`)} />
        </>
      }
      readout={
        <>
          <table className="iter-table">
            <thead>
              <tr><th style={{ textAlign: 'left' }}>To buy the package</th><th>Bid</th><th>Ask</th></tr>
            </thead>
            <tbody>
              {legs.map((l, i) => (
                <tr key={i}>
                  <td style={{ textAlign: 'left' }}>{fmtQty(l.qty)} {l.strike} {l.type}</td>
                  <td style={l.qty < 0 ? { color: 'var(--c-bid)', fontWeight: 700 } : { opacity: 0.6 }}>{l.bid.toFixed(2)}</td>
                  <td style={l.qty > 0 ? { color: 'var(--c-ask)', fontWeight: 700 } : { opacity: 0.6 }}>{l.ask.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p>
            Buying the package as one order instead of leg by leg saves <strong>{money(saving)}</strong> per package contract.{' '}
            <span className="muted">Net vega {cx.vegaPt >= 0 ? '+' : '−'}{Math.abs(cx.vegaPt).toFixed(3)} per vol point, net delta {cx.delta >= 0 ? '+' : '−'}{Math.abs(cx.delta).toFixed(2)}.</span>
          </p>
          <p className="muted">
            Legging in: after the first leg, the rest of the package moves with the stock. Over {minutes} min that's a standard deviation of about{' '}
            <span className="num">{money(risk * MULTIPLIER)}</span> per package contract.
          </p>
        </>
      }
      caption="Leg quotes are the three-month chain of Chapter 4; the bold price in each row is the one you trade at when buying the package. The package quote is a market maker pricing the package's net risk: half a volatility point of its net vega plus a cent per leg, on a penny grid, and never worse than the legs."
    />
  );
}
