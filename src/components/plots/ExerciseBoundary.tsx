import { Line, Point, Polygon, Polyline } from 'mafs';
import { useMemo, useState } from 'react';
import { gbmPath } from '../../lib/math/rng';
import { exerciseBoundary } from '../../lib/pricing/binomial';
import { DEFAULTS } from '../../lib/pricing/blackScholes';
import { Button, Slider } from '../ui/controls';
import { WidgetFrame } from '../ui/WidgetFrame';
import { money } from './format';
import { Label, PlotFrame } from './PlotFrame';

const HEIGHT = 320;
const N = 250;
const Y: [number, number] = [50, 130];

/**
 * Chapter 9: the American put's exercise boundary S*(t) and a random stock
 * path. The holder exercises the first time the path dips into the region
 * below the boundary.
 */
export default function ExerciseBoundary() {
  const [r, setR] = useState(0.05);
  const [sigma, setSigma] = useState(0.2);
  const [seed, setSeed] = useState(4);
  const T = 1;
  const boundary = useMemo(
    () => exerciseBoundary('put', { ...DEFAULTS, r, sigma, T, steps: 120, american: true }, 20).filter((b) => b.S !== null) as { t: number; S: number }[],
    [r, sigma],
  );
  const path = useMemo(() => gbmPath(seed, 100, r, sigma, T, N), [seed, r, sigma]);
  const boundaryAt = (t: number) => {
    for (let i = 1; i < boundary.length; i++) {
      if (t <= boundary[i].t) {
        const a = boundary[i - 1], b = boundary[i];
        return a.S + ((b.S - a.S) * (t - a.t)) / (b.t - a.t);
      }
    }
    return DEFAULTS.K;
  };
  const hit = path.findIndex((S, i) => S <= boundaryAt((i / N) * T));
  const shown = hit >= 0 ? path.slice(0, hit + 1) : path;
  const pts = shown.map((S, i) => [(i / N) * T, S] as [number, number]);
  const region = [...boundary.map((b) => [b.t, b.S] as [number, number]), [T, Y[0]], [0, Y[0]]] as [number, number][];

  const plot = (
    <PlotFrame
      x={[0, T]}
      y={Y}
      height={HEIGHT}
      xTicks={[0, 0.25, 0.5, 0.75, 1]}
      yTicks={[60, 80, 100, 120]}
      formatX={(t) => (t === 0 ? 'today' : t === 1 ? 'expiry' : `${Math.round(t * 12)} mo`)}
      formatY={(v) => `$${v}`}
      yLabel="stock price"
    >
      <Polygon points={region} color="var(--c-put)" fillOpacity={0.14} strokeOpacity={0} weight={0} />
      <Polyline points={boundary.map((b) => [b.t, b.S] as [number, number])} color="var(--c-put)" weight={3} fillOpacity={0} />
      <Label x={0.03} y={boundary[0]?.S ?? 80} attach="se" attachDistance={8} size={12} color="var(--c-put)">
        exercise region (S below S*)
      </Label>
      <Line.Segment point1={[0, DEFAULTS.K]} point2={[T, DEFAULTS.K]} color="var(--c-strike)" style="dashed" weight={1.5} opacity={0.6} />
      <Polyline points={pts} color="var(--c-spot)" weight={2.5} fillOpacity={0} />
      {hit >= 0 && (
        <>
          <Point x={(hit / N) * T} y={path[hit]} color="var(--c-rate)" />
          <Label x={(hit / N) * T} y={path[hit]} attach="ne" attachDistance={10} size={12} color="var(--c-rate)">
            exercise: receive {money(DEFAULTS.K - path[hit])}
          </Label>
        </>
      )}
    </PlotFrame>
  );

  return (
    <WidgetFrame
      title="The exercise boundary"
      ariaLabel={`The American put's exercise boundary starts near $${boundary[0]?.S.toFixed(0)} today and rises to the $100 strike at expiry. ${hit >= 0 ? `This path hits it after ${Math.round((hit / N) * 12)} months.` : 'This path never hits it.'}`}
      plotHeight={HEIGHT}
      plot={plot}
      controls={
        <>
          <Button onClick={() => setSeed((s) => s + 1)}>New random path</Button>
          <Slider label="Interest rate $\Rate{r}$" value={r} min={0.005} max={0.15} step={0.005} onChange={setR} format={(v) => `${(v * 100).toFixed(1)}%`} color="var(--c-rate)" />
          <Slider label="Volatility $\Vol{\sigma}$" value={sigma} min={0.1} max={0.5} step={0.01} onChange={setSigma} format={(v) => `${Math.round(v * 100)}%`} color="var(--c-vol)" />
        </>
      }
      readout={
        <p>
          Today the boundary is at <strong className="num" style={{ color: 'var(--c-put)' }}>{money(boundary[0]?.S ?? 0)}</strong>: exercise the $100 put if the stock is
          below it. {hit >= 0 ? (
            <>This path crosses it after <strong>{Math.round((hit / N) * 12 * 10) / 10} months</strong> at {money(path[hit])}, so the holder exercises and collects {money(DEFAULTS.K - path[hit])}.</>
          ) : (
            <>This path never enters the region, so the holder waits until expiry{path[N] < DEFAULTS.K ? ` and collects ${money(DEFAULTS.K - path[N])}` : ' and the put expires worthless'}.</>
          )}
        </p>
      }
      caption="Red curve: the critical price S*(t), computed from the binomial tree. Below it, exercising beats waiting. Blue: one random path of the stock. Re-roll it to see different outcomes."
    />
  );
}
