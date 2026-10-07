import { Line, Point, Polyline } from 'mafs';
import { useMemo, useState } from 'react';
import { dupireForward, dupirePrice, ssviLocalVol } from '../../lib/models/localVol';
import { impliedVol } from '../../lib/vol/impliedVol';
import { EQUITY_SSVI, ssviVol } from '../../lib/vol/smile';
import { Slider } from '../ui/controls';
import { WidgetFrame } from '../ui/WidgetFrame';
import { Label, PlotFrame } from './PlotFrame';

const S0 = 100, r = 0.05, T = 0.5;
const STRIKES = Array.from({ length: 33 }, (_, i) => 70 + i * 2);
const HEIGHT = 300;
const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

/**
 * Chapter 29: what local volatility predicts for tomorrow's smile. Calibrate
 * σ_loc to today's 6-month smile (spot 100), move the spot instantly, and
 * re-price with Dupire's forward equation from the new spot. Compare with
 * "sticky strike" (smile unchanged) and "sticky moneyness" (smile moves with spot).
 */
export default function LocalVolDynamics() {
  const [spot, setSpot] = useState(92);
  const lv = useMemo(() => ssviLocalVol(EQUITY_SSVI, S0, r), []);
  const today = (K: number, S = S0) => ssviVol(Math.log(K / (S * Math.exp(r * T))), T, EQUITY_SSVI);
  const lvSmile = useMemo(() => {
    const grid = dupireForward(spot, r, 0, lv, T, { Kmax: 300, nK: 300, nT: 100 });
    return STRIKES.map((K) => [K, impliedVol('call', dupirePrice(grid, K), { S: spot, K, T, r }).sigma] as [number, number]);
  }, [spot, lv]);
  const stickyStrike = STRIKES.map((K) => [K, today(K)] as [number, number]);
  const stickyMoneyness = STRIKES.map((K) => [K, today(K, spot)] as [number, number]);
  const atmLV = lvSmile.reduce((best, pt) => (Math.abs(pt[0] - spot) < Math.abs(best[0] - spot) ? pt : best))[1];
  const atmSK = today(spot), atmSM = today(spot, spot);
  const finite = lvSmile.filter(([, v]) => Number.isFinite(v));

  return (
    <WidgetFrame
      title="Where local vol moves the smile"
      ariaLabel={`Spot moves from 100 to ${spot}. At-the-money vol: local vol predicts ${pct(atmLV)}, sticky strike ${pct(atmSK)}, sticky moneyness ${pct(atmSM)}.`}
      plotHeight={HEIGHT}
      plot={
        <PlotFrame x={[70, 134]} y={[0.1, 0.32]} height={HEIGHT} xTicks={[70, 80, 90, 100, 110, 120, 130]} yTicks={[0.1, 0.15, 0.2, 0.25, 0.3]} formatX={(v) => `$${v}`} formatY={(v) => `${Math.round(v * 100)}%`} xLabel="strike K" yLabel="6-month implied vol">
          <Line.Segment point1={[S0, 0.1]} point2={[S0, 0.32]} color="var(--text-muted)" style="dashed" weight={1} />
          <Line.Segment point1={[spot, 0.1]} point2={[spot, 0.32]} color="var(--c-spot)" style="dashed" weight={1.5} />
          <Polyline points={stickyStrike} color="var(--text-muted)" weight={2} fillOpacity={0} />
          <Polyline points={stickyMoneyness} color="var(--c-call)" weight={2} strokeStyle="dashed" fillOpacity={0} />
          <Polyline points={finite} color="var(--c-vol)" weight={3.5} fillOpacity={0} />
          <Point x={spot} y={atmLV} color="var(--c-vol)" />
          <Label x={spot} y={0.315} attach="e" attachDistance={4} size={12} color="var(--c-spot)">new spot</Label>
          <Label x={134} y={stickyStrike[stickyStrike.length - 1][1]} attach="nw" attachDistance={6} size={12} color="var(--text-muted)">today</Label>
        </PlotFrame>
      }
      controls={<Slider label="Spot moves to" value={spot} min={85} max={115} step={1} onChange={setSpot} format={(v) => `$${v}`} color="var(--c-spot)" />}
      readout={
        <dl className="readout-grid">
          <dt className="num" style={{ color: 'var(--c-vol)' }}>Local vol model</dt><dd>ATM {pct(atmLV)}</dd>
          <dt>Sticky strike (grey)</dt><dd>ATM {pct(atmSK)}</dd>
          <dt style={{ color: 'var(--c-call)' }}>Sticky moneyness (dashed)</dt><dd>ATM {pct(atmSM)}</dd>
        </dl>
      }
      caption="Local vol calibrated to today's 6-month smile (spot \$100). After the spot jumps, the thick curve is the smile local vol implies, from Dupire's forward equation solved from the new spot."
    />
  );
}
