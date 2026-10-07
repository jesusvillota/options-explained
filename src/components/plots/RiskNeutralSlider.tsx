import { Line, MovablePoint, Point } from 'mafs';
import { useState } from 'react';
import { replicate } from '../../lib/pricing/oneStep';
import { Slider } from '../ui/controls';
import { Tex } from '../ui/Tex';
import { WidgetFrame } from '../ui/WidgetFrame';
import { clamp, money, percent } from './format';
import { Label, PlotFrame } from './PlotFrame';

const S0 = 100, Su = 120, Sd = 80, K = 100, T = 1;

/**
 * Chapter 12: slide the real-world probability of an up move. The stock's and
 * the option's expected returns change a lot; the option's price doesn't
 * change at all. Both expected returns equal the risk-free rate exactly at the
 * risk-neutral probability q.
 */
export default function RiskNeutralSlider() {
  const [p, setP] = useState(0.8);
  const [r, setR] = useState(0.05);
  const Vu = Su - K, Vd = 0;
  const rep = replicate({ S0, Su, Sd, Vu, Vd, r, T });
  const stockRet = (pp: number) => (pp * Su + (1 - pp) * Sd) / S0 - 1;
  const optRet = (pp: number) => (pp * Vu + (1 - pp) * Vd) / rep.price - 1;
  const rr = Math.exp(r * T) - 1;

  const plot = (
    <PlotFrame
      x={[0, 1]}
      y={[-1.1, 1.3]}
      height={320}
      xTicks={[0, 0.25, 0.5, 0.75, 1]}
      yTicks={[-1, -0.5, 0, 0.5, 1]}
      formatX={(v) => `${Math.round(v * 100)}%`}
      formatY={(v) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(Math.round(v * 100))}%`}
      baseline={0}
      xLabel="real-world chance of an up move, p"
      yLabel="expected return over the year"
    >
      <Line.Segment point1={[0, stockRet(0)]} point2={[1, stockRet(1)]} color="var(--c-spot)" weight={3} />
      <Line.Segment point1={[0, optRet(0)]} point2={[1, optRet(1)]} color="var(--c-call)" weight={3} />
      <Label x={0.98} y={stockRet(0.98)} attach="nw" attachDistance={8} size={12} color="var(--c-spot)">stock</Label>
      <Label x={0.98} y={optRet(0.98)} attach="sw" attachDistance={8} size={12} color="var(--c-call)">call</Label>
      <Line.Segment point1={[0, rr]} point2={[1, rr]} color="var(--c-rate)" style="dashed" weight={1.5} />
      <Line.Segment point1={[rep.q, -1.1]} point2={[rep.q, 1.3]} color="var(--c-prob)" style="dashed" weight={1.5} opacity={0.7} />
      <Point x={rep.q} y={rr} color="var(--c-rate)" />
      <Label x={rep.q} y={rr} attach="se" attachDistance={8} size={12} color="var(--c-rate)">
        q = {rep.q.toFixed(3)}: both earn r
      </Label>
      <Line.Segment point1={[p, stockRet(p)]} point2={[p, optRet(p)]} color="var(--text-muted)" style="dashed" weight={1} />
      <Point x={p} y={stockRet(p)} color="var(--c-spot)" />
      <Point x={p} y={optRet(p)} color="var(--c-call)" />
      <MovablePoint point={[p, -1.1]} color="var(--text)" onMove={([x]) => setP(Math.round(clamp(x, 0.01, 0.99) * 100) / 100)} constrain={([x]) => [clamp(x, 0.01, 0.99), -1.1]} />
    </PlotFrame>
  );

  return (
    <WidgetFrame
      title="The probability that doesn't matter"
      ariaLabel={`With a ${Math.round(p * 100)}% chance of an up move, the stock is expected to return ${percent(stockRet(p), 1)} and the call ${percent(optRet(p), 1)}, but the call's price stays ${money(rep.price)}.`}
      plotHeight={320}
      plot={plot}
      controls={
        <>
          <Slider label="Real-world chance of an up move $p$" value={p} min={0.01} max={0.99} step={0.01} onChange={setP} format={(v) => `${Math.round(v * 100)}%`} color="var(--text)" />
          <Slider label="Interest rate $\Rate{r}$" value={r} min={0} max={0.1} step={0.005} onChange={setR} format={(v) => `${(v * 100).toFixed(1)}%`} color="var(--c-rate)" />
        </>
      }
      readout={
        <dl className="readout-grid">
          <dt>Call price today</dt><dd style={{ color: 'var(--c-call)' }}>{money(rep.price)} <span className="muted">(whatever p is)</span></dd>
          <dt>Expected stock return</dt><dd>{percent(stockRet(p), 1)}</dd>
          <dt>Expected call return</dt><dd>{percent(optRet(p), 1)}</dd>
          <dt>Risk-neutral q</dt><dd>{(rep.q * 100).toFixed(1)}% <span className="muted"><Tex>{'= \\dfrac{S_0e^{rT} - S_d}{S_u - S_d}'}</Tex></span></dd>
        </dl>
      }
      caption="Stock: \$100 → \$120 or \$80 in a year; call struck at \$100. Drag the white point along the bottom (or use the slider) to change p."
    />
  );
}
