import { Line, Plot, Point } from 'mafs';
import { useMemo, useState } from 'react';
import { SURFACE_MARKET, fitSurface, noisyChain, trueVol, type CleaningChoices } from '../../lib/mm/surfaceFit';
import { Segmented } from '../ui/controls';
import { WidgetFrame } from '../ui/WidgetFrame';
import { Label, PlotFrame } from './PlotFrame';

type Stage = '0' | '1' | '2' | '3' | '4';
const HEIGHT = 300;
const Y: [number, number] = [0.08, 0.6];
const STAGES: Record<Stage, CleaningChoices> = {
  '0': { dropBad: false, dropStale: false, parityForward: false, weightBySpread: false, otmOnly: false },
  '1': { dropBad: true, dropStale: false, parityForward: false, weightBySpread: false, otmOnly: false },
  '2': { dropBad: true, dropStale: true, parityForward: false, weightBySpread: false, otmOnly: false },
  '3': { dropBad: true, dropStale: true, parityForward: true, weightBySpread: false, otmOnly: false },
  '4': { dropBad: true, dropStale: true, parityForward: true, weightBySpread: true, otmOnly: false },
};
const clampY = (v: number) => Math.min(Math.max(v, Y[0]), Y[1]);

interface NoisyChainFitProps {
  title?: string;
  initialStage?: Stage;
}

/**
 * Chapter 55: a raw three-month chain turned into implied-volatility bands
 * (bid to ask) for every call and put, with an SVI smile fitted to the mids.
 * Each cleaning step can be switched on in turn.
 */
export default function NoisyChainFit({ title = 'From a messy screen to a smile', initialStage = '0' }: NoisyChainFitProps) {
  const [stage, setStage] = useState<Stage>(initialStage);
  const rows = useMemo(() => noisyChain(), []);
  const fit = useMemo(() => fitSurface(rows, STAGES[stage]), [rows, stage]);
  const { S, r, q, T } = SURFACE_MARKET;
  const trueF = S * Math.exp((r - q) * T);
  const used = fit.points.filter((p) => !p.excluded).length;
  const reasons = fit.points.filter((p) => p.excluded).reduce((m, p) => m.set(p.reason!, (m.get(p.reason!) ?? 0) + 1), new Map<string, number>());

  const plot = (
    <PlotFrame x={[67, 133]} y={Y} height={HEIGHT} xTicks={[70, 80, 90, 100, 110, 120, 130]} yTicks={[0.1, 0.2, 0.3, 0.4, 0.5, 0.6]} formatX={(v) => `$${v}`} formatY={(v) => `${Math.round(v * 100)}%`} xLabel="strike" yLabel="implied volatility" marginLeft={44}>
      <Line.Segment point1={[fit.F, Y[0]]} point2={[fit.F, Y[1]]} color="var(--c-spot)" style="dashed" weight={1} />
      <Label x={fit.F} y={Y[1]} attach="se" attachDistance={4} size={11} color="var(--c-spot)">forward used</Label>
      <Plot.OfX y={trueVol} color="var(--c-vol)" weight={2} style="dashed" domain={[67, 133]} />
      <Plot.OfX y={(K) => clampY(fit.vol(K))} color="var(--text)" weight={2.5} domain={[67, 133]} />
      {fit.points.map((p) => {
        const x = p.strike + (p.type === 'call' ? 0.8 : -0.8);
        const color = p.type === 'call' ? 'var(--c-call)' : 'var(--c-put)';
        const lo = Number.isFinite(p.bidVol) ? p.bidVol : Y[0];
        const hi = Number.isFinite(p.askVol) ? p.askVol : Y[1];
        const op = p.excluded ? 0.18 : 0.9;
        return (
          <g key={`${p.type}${p.strike}`}>
            <Line.Segment point1={[x, clampY(lo)]} point2={[x, clampY(hi)]} color={color} weight={3} opacity={op} />
            {Number.isFinite(p.midVol) && <Point x={x} y={clampY(p.midVol)} color={color} opacity={op} />}
          </g>
        );
      })}
    </PlotFrame>
  );

  return (
    <WidgetFrame
      title={title}
      ariaLabel={`With ${used} quotes kept, the fitted smile lies inside ${Math.round(fit.insideBand * 100)}% of their bid–ask volatility bands and misses the true smile by ${fit.rmse.toFixed(2)} volatility points on average.`}
      plotHeight={HEIGHT}
      plot={plot}
      controls={
        <Segmented label="Cleaning steps" value={stage} onChange={setStage} options={[
          { value: '0', label: 'Raw quotes' },
          { value: '1', label: '+ drop bad' },
          { value: '2', label: '+ drop stale' },
          { value: '3', label: '+ parity forward' },
          { value: '4', label: '+ weights' },
        ]} />
      }
      readout={
        <dl className="readout-grid">
          <dt>Forward</dt><dd>{fit.F.toFixed(3)} <span className="muted">(true {trueF.toFixed(3)}; {STAGES[stage].parityForward ? 'from the parity regression' : 'from S e^(rT), ignoring the 1% yield'})</span></dd>
          <dt>Quotes used</dt><dd>{used} of {fit.points.length} <span className="muted">{[...reasons].map(([k, n]) => `${n} ${k}`).join(', ') || 'none dropped'}</span></dd>
          <dt>Fit</dt><dd>inside {Math.round(fit.insideBand * 100)}% of the kept bid–ask bands; {fit.rmse.toFixed(2)} vol points from the true smile</dd>
        </dl>
      }
      caption="Each bar runs from the implied volatility of a quote's bid to that of its ask (to the edge if the bid is zero or out of range); the dot is the mid. Green bars are calls, red puts; faded ones are dropped. The solid curve is the SVI fit, the dashed purple one the smile the quotes were made from."
    />
  );
}
