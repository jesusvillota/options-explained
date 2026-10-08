import { Line, Point, Polygon, Polyline } from 'mafs';
import { useMemo, useState } from 'react';
import { binImpact, fitPowerLaw, latentBook, simulateMetaorders, sqrtLawImpact } from '../../lib/exec/impact';
import { Button, Segmented, Slider } from '../ui/controls';
import { WidgetFrame } from '../ui/WidgetFrame';
import { niceTicks } from './format';
import { Label, PlotFrame } from './PlotFrame';

const SIGMA = 200; // daily volatility in basis points (2%)
const PARTICIPATION = 0.1;
const Q_MIN = 3e-4, Q_MAX = 0.1;
const BOOK_X: [number, number] = [0, 80];
const BOOK_Y: [number, number] = [0, 0.8];
const LOG_X: [number, number] = [-3.6, -0.9];
const LOG_Y: [number, number] = [-0.4, 2.4];
const SIZES = ['1000', '10000', '100000'] as const;
type Size = (typeof SIZES)[number];

const pctOfVolume = (q: number) => `${(q * 100).toLocaleString('en-US', { maximumSignificantDigits: 2 })}%`;

interface SquareRootImpactProps {
  title?: string;
  initialAlpha?: number;
}

/**
 * Chapter 61: why impact grows like the square root of size. Top: the hidden
 * ("latent") liquidity at each distance from the price, ρ(x) = L x^α, with the
 * area a metaorder of the chosen size must eat through. Bottom: synthetic
 * metaorders run through that book, plus the market's own noise, binned by
 * size on a log–log plot with a fitted power law.
 */
export default function SquareRootImpact({ title = 'Impact against size', initialAlpha = 1 }: SquareRootImpactProps) {
  const [alpha, setAlpha] = useState(initialAlpha);
  const [q, setQ] = useState(0.01);
  const [size, setSize] = useState<Size>('10000');
  const [seed, setSeed] = useState(61);

  const book = useMemo(() => latentBook(alpha, SIGMA), [alpha]);
  const { bins, fit } = useMemo(() => {
    const orders = simulateMetaorders({ n: Number(size), seed, alpha, sigmaDay: SIGMA, participation: PARTICIPATION, qMin: Q_MIN, qMax: Q_MAX });
    const b = binImpact(orders, 10, Q_MIN, Q_MAX);
    return { bins: b, fit: fitPowerLaw(b) };
  }, [alpha, size, seed]);

  const I = book.impact(q);
  const xs = Array.from({ length: 161 }, (_, i) => (BOOK_X[1] * i) / 160);
  const clampY = (v: number) => Math.min(v * 100, BOOK_Y[1]); // density in % of daily volume per bp
  const area = xs.filter((x) => x <= I).concat(I);
  const top = (
    <PlotFrame x={BOOK_X} y={BOOK_Y} height={170} xTicks={niceTicks(0, 80, 4)} yTicks={[0, 0.4, 0.8]} formatX={(v) => `${v} bp`} formatY={(v) => `${v}%`} xLabel="distance from the starting price" yLabel="hidden liquidity per bp" marginLeft={44}>
      {I <= BOOK_X[1] && (
        <Polygon points={[[0, 0], ...area.map((x) => [x, clampY(book.density(x))] as [number, number]), [I, 0]]} color="var(--c-bid)" fillOpacity={0.35} strokeOpacity={0} />
      )}
      <Polyline points={xs.map((x) => [x, clampY(book.density(x))] as [number, number])} color="var(--text)" weight={2} fillOpacity={0} />
      {I <= BOOK_X[1] && <Line.Segment point1={[I, 0]} point2={[I, BOOK_Y[1] * 0.6]} color="var(--c-bid)" weight={2} style="dashed" />}
      {I <= BOOK_X[1] && (
        <Label x={I} y={BOOK_Y[1] * 0.6} attach={I > 55 ? 'w' : 'e'} attachDistance={5} size={11} color="var(--c-bid)">{`price moves ${I.toFixed(0)} bp`}</Label>
      )}
    </PlotFrame>
  );

  const lq = (v: number) => Math.log10(v);
  const sqrtRef = (x: number) => lq(sqrtLawImpact(10 ** x, SIGMA));
  // The linear reference passes through the square-root law at 1% of daily volume.
  const linRef = (x: number) => lq(sqrtLawImpact(0.01, SIGMA)) + (x + 2);
  const linStart = Math.max(LOG_X[0], LOG_Y[0] - linRef(0));
  const linEnd = Math.min(LOG_X[1], LOG_Y[1] - 0.05 - linRef(0));
  const bottom = (
    <div style={{ borderTop: '1px solid var(--border)' }}>
      <PlotFrame x={LOG_X} y={LOG_Y} height={240} xTicks={[-3, -2, -1]} yTicks={[0, 1, 2]} formatX={(v) => pctOfVolume(10 ** v)} formatY={(v) => `${10 ** v} bp`} xLabel="metaorder size (share of daily volume, log scale)" yLabel="average impact (log scale)" marginLeft={52}>
        <Line.Segment point1={[linStart, linRef(linStart)]} point2={[linEnd, linRef(linEnd)]} color="var(--text-muted)" weight={1.5} style="dashed" />
        <Line.Segment point1={[LOG_X[0], sqrtRef(LOG_X[0])]} point2={[LOG_X[1], sqrtRef(LOG_X[1])]} color="var(--text-muted)" weight={1.5} style="dashed" />
        <Label x={-1.75} y={linRef(-1.75)} attach="nw" attachDistance={4} size={11} color="var(--text-muted)">slope 1</Label>
        <Label x={-3.55} y={sqrtRef(-3.55)} attach="se" attachDistance={4} size={11} color="var(--text-muted)">slope ½</Label>
        {Number.isFinite(fit.exponent) && (
          <Line.Segment point1={[LOG_X[0], lq(fit.prefactor) + fit.exponent * LOG_X[0]]} point2={[LOG_X[1], lq(fit.prefactor) + fit.exponent * LOG_X[1]]} color="var(--c-bid)" weight={2.5} />
        )}
        {bins.filter((b) => b.mean > 0).map((b) => {
          const x = lq(b.q);
          const hi = Math.min(lq(b.mean + 2 * b.se), LOG_Y[1]);
          const lo = b.mean - 2 * b.se > 0 ? lq(b.mean - 2 * b.se) : LOG_Y[0];
          return (
            <g key={b.q}>
              <Line.Segment point1={[x, Math.max(lo, LOG_Y[0])]} point2={[x, hi]} color="var(--text)" weight={1.5} opacity={0.6} />
              <Point x={x} y={lq(b.mean)} color="var(--text)" />
            </g>
          );
        })}
      </PlotFrame>
    </div>
  );

  const dropped = bins.filter((b) => b.mean <= 0).length;
  return (
    <WidgetFrame
      title={title}
      ariaLabel={`With hidden liquidity growing like distance to the power ${alpha.toFixed(1)}, the fitted impact exponent is ${fit.exponent.toFixed(2)}, against ${(1 / (1 + alpha)).toFixed(2)} in theory.`}
      plotHeight={410}
      plot={<>{top}{bottom}</>}
      controls={
        <>
          <Slider label="Shape of hidden liquidity $\alpha$" value={alpha} min={0} max={2} step={0.1} onChange={setAlpha} format={(v) => v.toFixed(1)} color="var(--c-bid)" />
          <Slider label="Order size (share of daily volume)" value={q} min={0.001} max={0.05} step={0.001} onChange={setQ} format={pctOfVolume} />
          <Segmented label="Metaorders in the sample" value={size} onChange={setSize} options={SIZES.map((s) => ({ value: s, label: `${Number(s).toLocaleString('en-US')} orders` }))} />
          <Button onClick={() => setSeed((s) => s + 1)}>Re-simulate</Button>
        </>
      }
      readout={
        <dl className="readout-grid">
          <dt>Fitted exponent</dt><dd>{Number.isFinite(fit.exponent) ? fit.exponent.toFixed(2) : '—'} <span className="muted">(the book's shape implies {(1 / (1 + alpha)).toFixed(2)})</span></dd>
          <dt>This order</dt><dd>{I.toFixed(1)} bp <span className="muted">(square-root law: {sqrtLawImpact(q, SIGMA).toFixed(1)} bp)</span></dd>
          <dt>Twice the size</dt><dd>{book.impact(2 * q).toFixed(1)} bp <span className="muted">(×{(book.impact(2 * q) / I).toFixed(2)})</span></dd>
        </dl>
      }
      caption={`A stock with 2% daily volatility. Top: hidden liquidity per basis point of distance from the price, as a percentage of daily volume. Each synthetic metaorder buys a share of the day's volume at ${PARTICIPATION * 100}% of the market's trading, moves the price through the hidden book above, and is buffeted by the market's own moves while it runs. Points: average impact in ten size bins, with ±2 standard errors${dropped ? ` (${dropped} bin${dropped > 1 ? 's' : ''} with a negative average can't be drawn on a log scale)` : ''}. Blue line: power-law fit.`}
    />
  );
}
