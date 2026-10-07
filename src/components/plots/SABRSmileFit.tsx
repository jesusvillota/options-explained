import { Point, Polyline } from 'mafs';
import { useState } from 'react';
import { calibrateSabr, sabrVol, type SABRParams } from '../../lib/models/sabr';
import { Button, Segmented, Slider } from '../ui/controls';
import { WidgetFrame } from '../ui/WidgetFrame';
import { Label, PlotFrame } from './PlotFrame';

type Beta = '0' | '0.5' | '1';
const F = 0.03, T = 2; // a 2-year option on a 3% forward swap rate
const STRIKES = [0.015, 0.02, 0.025, 0.03, 0.035, 0.04, 0.05];
// Stylised market quotes (lognormal vols): a SABR-like shape plus a little quote noise.
const NOISE = [0.004, -0.003, 0.002, 0, -0.002, 0.003, -0.002];
const MARKET = STRIKES.map((K, i) => sabrVol(F, K, T, { alpha: 0.052, beta: 0.5, rho: -0.3, nu: 0.5 }) + NOISE[i]);
const HEIGHT = 300;
const bp = (v: number) => `${(v * 100).toFixed(2)}%`;

/**
 * Chapter 32: fit Hagan's SABR formula to a stylised swaption smile, by hand or
 * by least squares, and see how the fitted smile moves when the forward rate
 * moves (dashed): it travels with the forward, unlike local volatility's.
 */
export default function SABRSmileFit() {
  const [beta, setBeta] = useState<Beta>('0.5');
  const [p, setP] = useState<Omit<SABRParams, 'beta'>>({ alpha: 0.04, rho: 0, nu: 0.3 });
  const [shift, setShift] = useState(0.005);
  const params: SABRParams = { ...p, beta: Number(beta) };
  const ks = Array.from({ length: 81 }, (_, i) => 0.01 + (0.045 * i) / 80);
  const curve = ks.map((K) => [K, sabrVol(F, K, T, params)] as [number, number]);
  const moved = ks.map((K) => [K, sabrVol(F + shift, K, T, params)] as [number, number]);
  const rmse = Math.sqrt(STRIKES.reduce((a, K, i) => a + (sabrVol(F, K, T, params) - MARKET[i]) ** 2, 0) / STRIKES.length);
  const fit = () => {
    const { params: q } = calibrateSabr(F, T, STRIKES, MARKET, Number(beta), { rho: p.rho, nu: p.nu });
    setP({ alpha: q.alpha, rho: q.rho, nu: q.nu });
  };
  // α's natural scale depends on β: at-the-money vol ≈ α / F^{1−β}.
  const alphaMax = 1.2 * Math.pow(F, 1 - Number(beta));
  const onBeta = (b: Beta) => {
    const atm = sabrVol(F, F, T, params);
    setBeta(b);
    setP({ ...p, alpha: atm * Math.pow(F, 1 - Number(b)) });
  };
  const atmNow = sabrVol(F, F, T, params), atmMoved = sabrVol(F + shift, F + shift, T, params);

  return (
    <WidgetFrame
      title="Fitting SABR to a swaption smile"
      ariaLabel={`SABR with β = ${beta}: fit error ${(rmse * 100).toFixed(2)} vol points. If the forward moves to ${bp(F + shift)}, at-the-money vol goes from ${bp(atmNow)} to ${bp(atmMoved)}.`}
      plotHeight={HEIGHT}
      plot={
        <PlotFrame x={[0.01, 0.055]} y={[0.2, 0.6]} height={HEIGHT} xTicks={[0.01, 0.02, 0.03, 0.04, 0.05]} yTicks={[0.2, 0.3, 0.4, 0.5, 0.6]} formatX={(v) => `${(v * 100).toFixed(0)}%`} formatY={(v) => `${Math.round(v * 100)}%`} xLabel="strike (swap rate)" yLabel="lognormal implied vol">
          <Polyline points={moved} color="var(--c-vol)" weight={1.5} strokeStyle="dashed" strokeOpacity={0.7} fillOpacity={0} />
          <Polyline points={curve} color="var(--c-vol)" weight={3} fillOpacity={0} />
          {STRIKES.map((K, i) => <Point key={K} x={K} y={MARKET[i]} color="var(--c-strike)" />)}
          <Label x={0.052} y={moved[moved.length - 9][1]} attach="n" attachDistance={6} size={11} color="var(--c-vol)">forward {shift >= 0 ? '+' : '−'}{Math.abs(shift * 10000).toFixed(0)}bp</Label>
        </PlotFrame>
      }
      controls={
        <>
          <Segmented label="Backbone β (fixed)" value={beta} onChange={onBeta} options={[
            { value: '0', label: 'β = 0 (normal)' },
            { value: '0.5', label: 'β = ½' },
            { value: '1', label: 'β = 1 (lognormal)' },
          ]} />
          <Button onClick={fit}>Fit α, ρ, ν</Button>
          <Slider label="Level α" value={Math.min(p.alpha, alphaMax)} min={alphaMax / 60} max={alphaMax} step={alphaMax / 600} onChange={(v) => setP({ ...p, alpha: v })} format={(v) => v.toPrecision(3)} color="var(--c-vol)" />
          <Slider label="Correlation ρ" value={p.rho} min={-0.95} max={0.95} step={0.01} onChange={(v) => setP({ ...p, rho: v })} format={(v) => v.toFixed(2)} color="var(--c-vol)" />
          <Slider label="Vol of vol ν" value={p.nu} min={0.01} max={1.5} step={0.01} onChange={(v) => setP({ ...p, nu: v })} format={(v) => v.toFixed(2)} color="var(--c-vol)" />
          <Slider label="Move the forward by" value={shift} min={-0.01} max={0.01} step={0.001} onChange={setShift} format={(v) => `${v >= 0 ? '+' : '−'}${Math.abs(v * 10000).toFixed(0)}bp`} color="var(--c-spot)" />
        </>
      }
      readout={
        <dl className="readout-grid">
          <dt>Fit error (RMSE)</dt><dd>{(rmse * 100).toFixed(2)} vol points</dd>
          <dt>ATM vol now → after the move</dt><dd>{bp(atmNow)} → {bp(atmMoved)}</dd>
        </dl>
      }
      caption="Yellow dots: stylised quotes for a 2-year option on a 3% forward swap rate. Solid: Hagan's SABR formula with your parameters. Dashed: the same parameters after the forward moves; SABR's smile travels with the forward."
    />
  );
}
