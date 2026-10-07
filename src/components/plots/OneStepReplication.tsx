import { Line, MovablePoint, Point, Polyline } from 'mafs';
import { useState } from 'react';
import { replicate } from '../../lib/pricing/oneStep';
import { payoff, type OptionType } from '../../lib/pricing/payoff';
import { Segmented, Slider } from '../ui/controls';
import { WidgetFrame } from '../ui/WidgetFrame';
import { clamp, money, signedMoney } from './format';
import { Label, PlotFrame, Sub } from './PlotFrame';

const S0 = 100;
const T = 1;

interface Props {
  initialRate?: number;
  typeToggle?: boolean;
  title?: string;
}

/**
 * Chapter 11: one step, two outcomes. Top: the tree (drag the up and down
 * prices). Bottom: the payoff plane, where replicating the option means
 * drawing the straight line (shares + bond) through its two payoff points.
 */
export default function OneStepReplication({ initialRate = 0, typeToggle = true, title = 'Replicating an option in a one-step world' }: Props) {
  const [type, setType] = useState<OptionType>('call');
  const [Su, setSu] = useState(120);
  const [Sd, setSd] = useState(80);
  const [K, setK] = useState(100);
  const [r, setR] = useState(initialRate);
  const Vu = payoff(type, Su, K);
  const Vd = payoff(type, Sd, K);
  const rep = replicate({ S0, Su, Sd, Vu, Vd, r, T });
  const growth = Math.exp(r * T);
  const F = S0 * growth;
  const line = (s: number) => rep.delta * s + rep.bond * growth;
  const color = type === 'call' ? 'var(--c-call)' : 'var(--c-put)';
  const d3 = (x: number) => x.toFixed(3).replace('-', '−');

  const tree = (
    <PlotFrame x={[-0.55, 1]} y={[40, 170]} height={230} xTicks={[0, 1]} yTicks={[50, 100, 150]} formatX={(t) => (t === 0 ? 'today' : 'in one year')} formatY={(v) => `$${v}`} yLabel="stock price">
      <Line.Segment point1={[0, S0]} point2={[1, Su]} color="var(--c-spot)" weight={2.5} />
      <Line.Segment point1={[0, S0]} point2={[1, Sd]} color="var(--c-spot)" weight={2.5} />
      <Point x={0} y={S0} color="var(--c-spot)" />
      <Label x={0} y={S0} attach="w" attachDistance={12} size={13} color="var(--text)">
        today: $100, {type} = {money(rep.price)}
      </Label>
      <Label x={1} y={Su} attach="nw" attachDistance={14} size={13} color="var(--text)">
        up: ${Su} → {type} pays {money(Vu)}
      </Label>
      <Label x={1} y={Sd} attach="sw" attachDistance={14} size={13} color="var(--text)">
        down: ${Sd} → {type} pays {money(Vd)}
      </Label>
      <MovablePoint point={[1, Su]} color="var(--c-spot)" onMove={([, y]) => setSu(Math.round(clamp(y, Sd + 5, 165)))} constrain={([, y]) => [1, clamp(y, Sd + 5, 165)]} />
      <MovablePoint point={[1, Sd]} color="var(--c-spot)" onMove={([, y]) => setSd(Math.round(clamp(y, 45, Su - 5)))} constrain={([, y]) => [1, clamp(y, 45, Su - 5)]} />
    </PlotFrame>
  );

  const xLo = 40, xHi = 170;
  const plane = (
    <div style={{ borderTop: '1px solid var(--border)' }}>
      <PlotFrame
        x={[xLo, xHi]}
        y={[-15, 75]}
        height={260}
        xTicks={[50, 75, 100, 125, 150]}
        yTicks={[0, 25, 50, 75]}
        formatX={(v) => `$${v}`}
        formatY={(v) => `$${v}`}
        baseline={0}
        xLabel={<>stock price in a year <Sub base="S" sub="T" /></>}
        yLabel="value in a year"
      >
        <Polyline points={[[xLo, payoff(type, xLo, K)], [K, 0], [xHi, payoff(type, xHi, K)]]} color={color} weight={2} strokeStyle="dashed" strokeOpacity={0.5} fillOpacity={0} />
        <Line.Segment point1={[xLo, line(xLo)]} point2={[xHi, line(xHi)]} color="var(--text)" weight={2.5} />
        <Point x={Su} y={Vu} color={color} />
        <Point x={Sd} y={Vd} color={color} />
        <Line.Segment point1={[F, 0]} point2={[F, line(F)]} color="var(--c-rate)" style="dashed" weight={1.5} />
        <Point x={F} y={line(F)} color="var(--c-rate)" />
        <Label x={F} y={line(F)} attach={rep.delta >= 0 ? 'nw' : 'ne'} attachDistance={10} size={12} color="var(--c-rate)">
          at the forward: {money(line(F))}
        </Label>
        <Label x={xHi - 3} y={line(xHi - 3)} attach={rep.delta >= 0 ? 'nw' : 'sw'} attachDistance={8} size={12} color="var(--text)">
          {d3(rep.delta)} shares + bond
        </Label>
      </PlotFrame>
    </div>
  );

  return (
    <WidgetFrame
      title={title}
      ariaLabel={`One-step tree from $100 to $${Su} or $${Sd}. The ${type} is replicated by ${d3(rep.delta)} shares and ${money(Math.abs(rep.bond))} ${rep.bond < 0 ? 'borrowed' : 'lent'}, so it costs ${money(rep.price)}.`}
      plotHeight={490}
      plot={<>{tree}{plane}</>}
      controls={
        <>
          {typeToggle && (
            <Segmented label="Option type" value={type} onChange={setType} options={[
              { value: 'call', label: 'Call', color: 'var(--c-call)' },
              { value: 'put', label: 'Put', color: 'var(--c-put)' },
            ]} />
          )}
          <Slider label="Strike $\Strike{K}$" value={K} min={70} max={130} onChange={setK} format={(v) => `$${v}`} color="var(--c-strike)" />
          <Slider label="Interest rate $\Rate{r}$ (per year)" value={r} min={0} max={0.1} step={0.005} onChange={setR} format={(v) => `${(v * 100).toFixed(1)}%`} color="var(--c-rate)" />
        </>
      }
      readout={
        rep.arbitrageFree ? (
          <>
            <p>
              <strong>Recipe:</strong> hold <strong className="num">{d3(rep.delta)}</strong> shares (Δ) and {rep.bond < 0 ? 'borrow' : 'lend'}{' '}
              <strong className="num">{money(Math.abs(rep.bond))}</strong>. Cost today: <strong className="num" style={{ color }}>{money(rep.price)}</strong>.
            </p>
            <p className="muted">
              Up: {d3(rep.delta)} × ${Su} {signedMoney(rep.bond * growth)} = {money(line(Su))} ✓ · Down: {d3(rep.delta)} × ${Sd}{' '}
              {signedMoney(rep.bond * growth)} = {money(line(Sd))} ✓
            </p>
          </>
        ) : (
          <p>
            <strong className="bad">The stock itself is an arbitrage.</strong> The down price must be below ${F.toFixed(2)} (what $100 grows to at the
            bank) and the up price above it. Otherwise one of "buy the stock with borrowed money" or "short it and bank the cash" never loses.
          </p>
        )
      }
      caption="Drag the up and down prices (blue points, top). Bottom: the straight line through the option's two payoffs is the replicating portfolio. Its value at the forward price, discounted, is the option's price."
    />
  );
}
