import { Line, MovablePoint, Polygon, Polyline } from 'mafs';
import { useEffect, useRef, useState } from 'react';
import { DEFAULTS, price } from '../../lib/pricing/blackScholes';
import { moneyness, payoff, type OptionType } from '../../lib/pricing/payoff';
import { Button, Segmented, Slider } from '../ui/controls';
import { WidgetFrame } from '../ui/WidgetFrame';
import { usePrefersReducedMotion } from './animation';
import { clamp, money, signedMoney } from './format';
import { Label, PlotFrame } from './PlotFrame';

interface TimeValueDiagramProps {
  title?: string;
  caption?: string;
  type?: OptionType;
  typeToggle?: boolean;
  /** Show a volatility slider. */
  volSlider?: boolean;
  initialSpot?: number;
  initialTau?: number;
}

const X: [number, number] = [40, 160];
const Y: [number, number] = [-8, 72];
const HEIGHT = 340;
const SAMPLES = 120;
const CLOCK_SECONDS = 4;

const formatTau = (tau: number) => {
  if (tau <= 0) return 'expiry';
  const months = tau * 12;
  return months < 11.5 ? `${months.toFixed(months < 1 ? 1 : 0)} mo` : `${tau.toFixed(2)} yr`;
};

/**
 * Chapter 3: the option's price before expiry (Black–Scholes, used as a black
 * box for now) drawn over its intrinsic value (the hockey stick). The shaded
 * gap is the time value; running the clock closes it.
 */
export default function TimeValueDiagram({
  title = 'Price before expiry',
  caption,
  type: initialType = 'call',
  typeToggle = true,
  volSlider = false,
  initialSpot = 110,
  initialTau = 1,
}: TimeValueDiagramProps) {
  const [type, setType] = useState<OptionType>(initialType);
  const [spot, setSpot] = useState(initialSpot);
  const [tau, setTau] = useState(initialTau);
  const [sigma, setSigma] = useState(DEFAULTS.sigma);
  const [running, setRunning] = useState(false);
  const reduced = usePrefersReducedMotion();
  const K = DEFAULTS.K;

  // "Run the clock": time to expiry falls to zero at a steady pace.
  const tauRef = useRef(tau);
  tauRef.current = tau;
  useEffect(() => {
    if (!running) return;
    if (reduced) {
      setTau(0);
      setRunning(false);
      return;
    }
    const start = performance.now();
    const from = tauRef.current;
    const duration = (CLOCK_SECONDS * 1000 * from) / Math.max(initialTau, 0.25);
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      setTau(Math.max(from * (1 - t), 0));
      if (t < 1) frame = requestAnimationFrame(tick);
      else setRunning(false);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [running, reduced, initialTau]);

  const market = { ...DEFAULTS, T: tau, sigma };
  const value = (s: number) => price(type, { ...market, S: s });
  const intrinsic = (s: number) => payoff(type, s, K);
  const xs = Array.from({ length: SAMPLES + 1 }, (_, i) => X[0] + ((X[1] - X[0]) * i) / SAMPLES);
  const priceCurve = xs.map((s) => [s, value(s)] as [number, number]);
  const intrinsicCurve = xs.map((s) => [s, intrinsic(s)] as [number, number]);
  const gapShape = [...priceCurve, ...[...intrinsicCurve].reverse()];

  const color = type === 'call' ? 'var(--c-call)' : 'var(--c-put)';
  const v = value(spot);
  const iv = intrinsic(spot);
  const tv = v - iv;
  const m = moneyness(type, spot, K);
  const mLabel = { ITM: 'in the money', ATM: 'at the money', OTM: 'out of the money' }[m];

  const plot = (
    <PlotFrame
      x={X}
      y={Y}
      height={HEIGHT}
      xTicks={[40, 60, 80, 100, 120, 140, 160]}
      yTicks={[0, 20, 40, 60]}
      formatX={(x) => `$${x}`}
      formatY={(y) => `$${y}`}
      baseline={0}
      xLabel="stock price today"
      yLabel="option value"
    >
      <Line.Segment point1={[K, Y[0]]} point2={[K, Y[1]]} color="var(--c-strike)" style="dashed" weight={1.5} opacity={0.6} />
      <Polygon points={gapShape} color="var(--c-time)" fillOpacity={0.16} strokeOpacity={0} weight={0} />
      <Polyline points={intrinsicCurve} color={color} weight={2} fillOpacity={0} strokeOpacity={0.55} strokeStyle="dashed" />
      <Polyline points={priceCurve} color={color} weight={4} fillOpacity={0} />
      {Math.abs(tv) > 0.05 && <Line.Segment point1={[spot, iv]} point2={[spot, v]} color="var(--c-time)" weight={4} />}
      <Label x={spot} y={Math.max(v, iv)} attach={type === 'call' ? 'nw' : 'ne'} attachDistance={16} size={12} color="var(--c-time)">
        time value {signedMoney(tv)}
      </Label>
      <MovablePoint
        point={[spot, v]}
        color="var(--c-spot)"
        onMove={([x]) => setSpot(Math.round(clamp(x, ...X)))}
        constrain={([x]) => {
          const s = clamp(x, ...X);
          return [s, value(s)];
        }}
      />
    </PlotFrame>
  );

  const controls = (
    <>
      {typeToggle && (
        <Segmented label="Option type" value={type} onChange={setType} options={[
          { value: 'call', label: 'Call', color: 'var(--c-call)' },
          { value: 'put', label: 'Put', color: 'var(--c-put)' },
        ]} />
      )}
      <Button onClick={() => (tau > 0 ? setRunning(true) : setTau(initialTau))} disabled={running}>
        {tau > 0 ? 'Run the clock ▶' : 'Reset the clock'}
      </Button>
      <Slider label="Stock price today $\Spot{S}$" value={spot} min={X[0]} max={X[1]} onChange={setSpot} format={(x) => `$${x}`} color="var(--c-spot)" />
      <Slider
        label="Time to expiry $\Time{\tau}$"
        value={tau}
        min={0}
        max={2}
        step={0.01}
        onChange={(t) => { setRunning(false); setTau(t); }}
        format={formatTau}
        color="var(--c-time)"
      />
      {volSlider && (
        <Slider label="Volatility $\Vol{\sigma}$" value={sigma} min={0.05} max={0.6} step={0.01} onChange={setSigma} format={(s) => `${Math.round(s * 100)}%`} color="var(--c-vol)" />
      )}
    </>
  );

  const readout = (
    <dl className="readout-grid">
      <dt>Moneyness</dt>
      <dd>{mLabel} <span className="muted">({m})</span></dd>
      <dt>Option price</dt>
      <dd>{money(v)}</dd>
      <dt>Intrinsic value</dt>
      <dd>{money(iv)}</dd>
      <dt>Time value</dt>
      <dd style={{ color: 'var(--c-time)' }}>{signedMoney(tv)}{tv < -0.005 && <span className="muted"> (negative)</span>}</dd>
    </dl>
  );

  return (
    <WidgetFrame
      title={title}
      ariaLabel={`Price of a ${type} with strike $${K} and ${formatTau(tau)} to expiry, drawn above its intrinsic value. At a stock price of $${spot} it is worth $${v.toFixed(2)}, of which $${tv.toFixed(2)} is time value.`}
      plotHeight={HEIGHT}
      plot={plot}
      controls={controls}
      readout={readout}
      caption={caption ?? 'Solid line: what the option is worth today. Dashed line: what it would pay if exercised right now. The shaded gap is the time value.'}
    />
  );
}
