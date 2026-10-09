import { Line, Polyline } from 'mafs';
import { Fragment, useMemo, useState } from 'react';
import { CRASH, insurerGamma, maxDrawdown, simulateCrash, spiralMultiplier } from '../../lib/feedback/spirals';
import { Button, Slider } from '../ui/controls';
import { WidgetFrame } from '../ui/WidgetFrame';
import { extent, niceTicks } from './format';
import { Label, PlotFrame } from './PlotFrame';

const LINES = [
  { key: 'none', color: 'var(--text-muted)', weight: 1.5, label: 'no insurers' },
  { key: 'deep', color: 'var(--c-spot)', weight: 2, label: 'insurers' },
  { key: 'thin', color: 'var(--c-put)', weight: 2.5, label: 'insurers, liquidity withdrawn' },
] as const;

interface PortfolioInsuranceCrashProps {
  title?: string;
  initialInsured?: number;
}

/**
 * Chapter 69: portfolio insurance meets thin liquidity. The same news (a 5%
 * fall on day 2) and the same noise, in a market without insurers, with
 * insurers selling into the fall, and with liquidity providers also pulling
 * back as volatility rises. Bottom: the price impact of a million shares.
 */
export default function PortfolioInsuranceCrash({ title = 'From a fall to a crash', initialInsured = 0.1 }: PortfolioInsuranceCrashProps) {
  const [insured, setInsured] = useState(initialInsured);
  const [withdrawal, setWithdrawal] = useState(1);
  const [seed, setSeed] = useState(69);
  const paths = useMemo(() => ({
    none: simulateCrash({ seed, insuredShare: 0, withdrawal }),
    deep: simulateCrash({ seed, insuredShare: insured, withdrawal: 0 }),
    thin: simulateCrash({ seed, insuredShare: insured, withdrawal }),
  }), [seed, insured, withdrawal]);

  const [lo, hi] = extent([...paths.none.price, ...paths.deep.price, ...paths.thin.price]);
  const yLo = Math.max(0, lo - 3), yHi = hi + 4;
  const top = (
    <PlotFrame x={[0, CRASH.days]} y={[yLo, yHi]} height={210} xTicks={[0, 2, 4, 6, 8, 10]} yTicks={niceTicks(yLo, yHi, 4)} formatX={(d) => `day ${d}`} formatY={(v) => `$${v}`} yLabel="stock price" marginLeft={44}>
      <Line.Segment point1={[0, CRASH.floor]} point2={[CRASH.days, CRASH.floor]} color="var(--text-muted)" weight={1} style="dashed" />
      <Label x={CRASH.days} y={CRASH.floor} attach="nw" attachDistance={4} size={11} color="var(--text-muted)">insured floor</Label>
      {LINES.map((l) => (
        <Polyline key={l.key} points={paths[l.key].t.map((t, i) => [t, paths[l.key].price[i]] as [number, number])} color={l.color} weight={l.weight} fillOpacity={0} />
      ))}
    </PlotFrame>
  );

  const impact = paths.thin.lambda.map((x) => x * 1e6); // dollars per million shares on a ~$100 stock ≈ % move
  const iMax = Math.max(1, ...impact) * 1.2;
  const bottom = (
    <div style={{ borderTop: '1px solid var(--border)' }}>
      <PlotFrame x={[0, CRASH.days]} y={[0, iMax]} height={130} xTicks={[0, 2, 4, 6, 8, 10]} yTicks={niceTicks(0, iMax, 3)} formatX={(d) => `day ${d}`} formatY={(v) => `$${v}`} xLabel="trading days" yLabel="impact of 1 million shares" marginLeft={44}>
        <Polyline points={paths.thin.t.map((t, i) => [t, impact[i]] as [number, number])} color="var(--c-put)" weight={2} fillOpacity={0} />
        <Line.Segment point1={[0, CRASH.lambda * 1e6]} point2={[CRASH.days, CRASH.lambda * 1e6]} color="var(--text-muted)" weight={1} style="dashed" />
      </PlotFrame>
    </div>
  );

  const m = CRASH.lambda * insurerGamma(95, insured * CRASH.shares);
  return (
    <WidgetFrame
      title={title}
      ariaLabel={`With ${(insured * 100).toFixed(0)}% of shares insured, the largest fall is ${(maxDrawdown(paths.thin.price) * 100).toFixed(0)}% when liquidity is withdrawn, against ${(maxDrawdown(paths.none.price) * 100).toFixed(0)}% without insurers.`}
      plotHeight={340}
      plot={<>{top}{bottom}</>}
      controls={
        <>
          <Slider label="Share of the market insured" value={insured} min={0} max={0.2} step={0.01} onChange={setInsured} format={(v) => `${(v * 100).toFixed(0)}%`} color="var(--c-spot)" />
          <Slider label="Liquidity withdrawal as volatility rises" value={withdrawal} min={0} max={1.5} step={0.1} onChange={setWithdrawal} format={(v) => v.toFixed(1)} color="var(--c-put)" />
          <Button onClick={() => setSeed((s) => s + 1)}>Re-simulate</Button>
        </>
      }
      readout={
        <dl className="readout-grid">
          {LINES.map((l) => (
            <Fragment key={l.key}><dt style={{ color: l.color }}>{l.label}</dt><dd>largest fall {(maxDrawdown(paths[l.key].price) * 100).toFixed(1)}%</dd></Fragment>
          ))}
          <dt>Spiral at $95</dt><dd>m = {m.toFixed(2)} <span className="muted">each $1 fall triggers ${m.toFixed(2)} more: total ×{spiralMultiplier(m).toFixed(2)} at normal liquidity</span></dd>
        </dl>
      }
      caption="A toy market of 100 million shares at \$100, normally moved 0.4% by a million shares. Portfolio insurers protect a share of the market against falls below \$90 over three months by holding N(d₁) of their shares, rebalancing every half hour. On day 2, news knocks 5% off the price. Grey: no insurers. Blue: insurers, with steady liquidity. Red: insurers, with liquidity providers who demand more for each trade as recent moves grow; the lower panel shows how much a million shares then move the price."
    />
  );
}
