import { Line, Point } from 'mafs';
import { useEffect, useMemo, useState } from 'react';
import { binomialTree, crrParameters } from '../../lib/pricing/binomial';
import { DEFAULTS, price } from '../../lib/pricing/blackScholes';
import type { OptionType } from '../../lib/pricing/payoff';
import { Button, Segmented, Slider } from '../ui/controls';
import { WidgetFrame } from '../ui/WidgetFrame';
import { usePrefersReducedMotion } from './animation';
import { money } from './format';
import { Label, PlotFrame } from './PlotFrame';

const HEIGHT = 380;

interface Props {
  initialSteps?: number;
  initialType?: OptionType;
  initialAmerican?: boolean;
  title?: string;
}

/**
 * Chapter 13: an n-step CRR tree, filled in backwards from expiry one column
 * at a time. Each node is the discounted risk-neutral average of its two
 * children; American nodes also compare with exercising (orange).
 */
export default function BinomialTreeAnimated({ initialSteps = 4, initialType = 'put', initialAmerican = true, title = 'Backward induction on a tree' }: Props) {
  const [steps, setSteps] = useState(initialSteps);
  const [type, setType] = useState<OptionType>(initialType);
  const [american, setAmerican] = useState(initialAmerican);
  const [revealed, setRevealed] = useState(1);
  const [playing, setPlaying] = useState(false);
  const reduced = usePrefersReducedMotion();
  const input = { ...DEFAULTS, steps, american };
  const tree = useMemo(() => binomialTree(type, input), [type, steps, american]);
  const { dt, p } = crrParameters(input);
  const done = revealed >= steps + 1;

  useEffect(() => setRevealed(1), [type, steps, american]);
  useEffect(() => {
    if (!playing) return;
    if (done) return setPlaying(false);
    const id = setTimeout(() => setRevealed((v) => v + 1), reduced ? 0 : 700);
    return () => clearTimeout(id);
  }, [playing, revealed, done, reduced]);

  const all = tree.flat();
  const yMin = Math.min(...all.map((n) => n.S)) * 0.9;
  const yMax = Math.max(...all.map((n) => n.S)) * 1.06;
  const isRevealed = (i: number) => i >= steps + 1 - revealed;
  const showLabels = steps <= 6;
  const exerciseCount = all.filter((n) => n.exercise && isRevealed(n.i)).length;
  const color = type === 'call' ? 'var(--c-call)' : 'var(--c-put)';
  const currentCol = steps + 1 - revealed;

  const plot = (
    <PlotFrame
      x={[-0.08, 1.12]}
      y={[yMin, yMax]}
      height={HEIGHT}
      xTicks={Array.from({ length: steps + 1 }, (_, i) => i / steps)}
      yTicks={[60, 80, 100, 120, 140, 160, 180].filter((v) => v > yMin && v < yMax)}
      formatX={(t) => (t === 0 ? 'today' : t === 1 ? 'expiry' : `${Math.round(t * 12)} mo`)}
      formatY={(v) => `$${v}`}
      yLabel="stock price at each node"
    >
      {tree.slice(0, steps).flatMap((col) =>
        col.flatMap((n) => [
          <Line.Segment key={`u${n.i}-${n.j}`} point1={[n.i * dt, n.S]} point2={[(n.i + 1) * dt, tree[n.i + 1][n.j + 1].S]} color="var(--c-spot)" weight={1.2} opacity={0.35} />,
          <Line.Segment key={`d${n.i}-${n.j}`} point1={[n.i * dt, n.S]} point2={[(n.i + 1) * dt, tree[n.i + 1][n.j].S]} color="var(--c-spot)" weight={1.2} opacity={0.35} />,
        ]),
      )}
      {all.map((n) => (
        <Point
          key={`n${n.i}-${n.j}`}
          x={n.i * dt}
          y={n.S}
          color={!isRevealed(n.i) ? 'var(--text-muted)' : n.exercise ? 'var(--c-rate)' : n.i === currentCol ? 'var(--c-spot)' : color}
          opacity={isRevealed(n.i) ? 1 : 0.35}
        />
      ))}
      {showLabels &&
        all.filter((n) => isRevealed(n.i)).map((n) => (
          <Label key={`l${n.i}-${n.j}`} x={n.i * dt} y={n.S} attach="e" attachDistance={8} size={11} color={n.exercise ? 'var(--c-rate)' : 'var(--text)'}>
            {n.value.toFixed(2)}
          </Label>
        ))}
    </PlotFrame>
  );

  const root = tree[0][0].value;
  return (
    <WidgetFrame
      title={title}
      ariaLabel={`A ${steps}-step binomial tree for a ${american ? 'American' : 'European'} ${type} with strike $100. ${done ? `Its value today is ${money(root)}.` : 'Values are being filled in from expiry backwards.'}`}
      plotHeight={HEIGHT}
      plot={plot}
      controls={
        <>
          <Button onClick={() => setRevealed((v) => Math.min(v + 1, steps + 1))} disabled={done || playing}>◀ Step back one period</Button>
          <Button onClick={() => setPlaying(true)} disabled={done || playing}>Play</Button>
          <Button onClick={() => { setPlaying(false); setRevealed(1); }} disabled={revealed === 1}>Reset</Button>
          <Segmented label="Option type" value={type} onChange={setType} options={[
            { value: 'call', label: 'Call', color: 'var(--c-call)' },
            { value: 'put', label: 'Put', color: 'var(--c-put)' },
          ]} />
          <Segmented label="Exercise style" value={american ? 'am' : 'eu'} onChange={(v) => setAmerican(v === 'am')} options={[
            { value: 'eu', label: 'European' },
            { value: 'am', label: 'American', color: 'var(--c-rate)' },
          ]} />
          <Slider label="Number of steps $n$" value={steps} min={1} max={8} onChange={setSteps} format={(v) => String(v)} color="var(--c-time)" />
        </>
      }
      readout={
        <>
          <p>
            {revealed === 1 ? (
              <>At expiry each node is just the payoff. Step back to fill in the earlier columns.</>
            ) : done ? (
              <>
                <strong>Value today: <span style={{ color }}>{money(root)}</span></strong> (Black–Scholes European: {money(price(type, DEFAULTS))}).
                {american && exerciseCount > 0 && <> Orange nodes: exercise early ({exerciseCount}).</>}
              </>
            ) : (
              <>
                Column {currentCol}: each node = e<sup>−rΔt</sup> × [q × up child + (1 − q) × down child]
                {american ? ', or the payoff if that is larger.' : '.'}
              </>
            )}
          </p>
          <p className="muted">
            Δt = {dt.toFixed(3)} yr, u = e<sup>σ√Δt</sup> = {Math.exp(DEFAULTS.sigma * Math.sqrt(dt)).toFixed(4)}, q = {p.toFixed(4)}.
          </p>
        </>
      }
      caption="Blue lines: every path the stock can take. Labels: the option's value at each node, filled in from the right. Up to 6 steps show labels; more steps show just the colours."
    />
  );
}
