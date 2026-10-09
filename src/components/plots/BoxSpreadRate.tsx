import { Line, Point } from 'mafs';
import { useMemo, useState } from 'react';
import { boxRate } from '../../lib/micro/frictions';
import { complexQuote, impliedFromLegs, quoteLegs } from '../../lib/micro/packages';
import { Segmented } from '../ui/controls';
import { WidgetFrame } from '../ui/WidgetFrame';
import { Label, PlotFrame } from './PlotFrame';

type Box = '95/105' | '90/110' | '80/120';
const T = 0.25;
const HEIGHT = 190;
const pct = (v: number) => `${v < 0 ? '−' : ''}${Math.abs(v * 100).toFixed(2)}%`;

/**
 * Chapter 48: a box spread (bull call spread + bear put spread on the same two
 * strikes) pays the difference between the strikes at expiry, whatever happens.
 * Its price is a loan: buying it lends at an implied rate, selling it borrows.
 */
export default function BoxSpreadRate({ title = 'A box spread is a loan' }: { title?: string }) {
  const [box, setBox] = useState<Box>('90/110');
  const [k1, k2] = box.split('/').map(Number);
  const legs = useMemo(() => quoteLegs([
    { type: 'call', strike: k1, qty: 1 }, { type: 'call', strike: k2, qty: -1 },
    { type: 'put', strike: k2, qty: 1 }, { type: 'put', strike: k1, qty: -1 },
  ]), [k1, k2]);
  const width = k2 - k1;
  const m = impliedFromLegs(legs), c = complexQuote(legs);
  const rows = [
    { label: 'Leg by leg', lend: boxRate(m.ask, width, T), borrow: boxRate(m.bid, width, T), y: 2 },
    { label: 'As one package', lend: boxRate(c.ask, width, T), borrow: boxRate(c.bid, width, T), y: 1 },
  ];
  const X: [number, number] = [-0.3, 0.38];

  const plot = (
    <PlotFrame x={X} y={[0.3, 2.85]} height={HEIGHT} xTicks={[-0.2, -0.1, 0, 0.1, 0.2, 0.3]} yTicks={[]} formatX={(v) => `${v < 0 ? '−' : ''}${Math.abs(Math.round(v * 100))}%`} xLabel="implied interest rate (a year)" marginLeft={14}>
      <Line.Segment point1={[0.05, 0.45]} point2={[0.05, 2.75]} color="var(--c-rate)" style="dashed" weight={1.5} />
      <Label x={0.05} y={0.45} attach="e" attachDistance={4} size={11} color="var(--c-rate)">risk-free 5%</Label>
      {rows.map((r) => (
        <g key={r.label}>
          <Line.Segment point1={[Math.max(r.lend, X[0]), r.y]} point2={[Math.min(r.borrow, X[1]), r.y]} color="var(--text-muted)" weight={6} opacity={0.35} />
          <Point x={Math.max(r.lend, X[0])} y={r.y} color="var(--c-bid)" />
          <Point x={Math.min(r.borrow, X[1])} y={r.y} color="var(--c-ask)" />
          <Label x={Math.max(r.lend, X[0])} y={r.y} attach="sw" attachDistance={7} size={11} color="var(--c-bid)">{`lend ${pct(r.lend)}`}</Label>
          <Label x={Math.min(r.borrow, X[1])} y={r.y} attach="se" attachDistance={7} size={11} color="var(--c-ask)">{`borrow ${pct(r.borrow)}`}</Label>
          <Label x={X[0]} y={r.y + 0.32} attach="e" attachDistance={4} size={12} color="var(--text)">{r.label}</Label>
        </g>
      ))}
    </PlotFrame>
  );

  return (
    <WidgetFrame
      title={title}
      ariaLabel={`The ${box} box pays ${width} at expiry. Leg by leg it implies lending at ${pct(rows[0].lend)} and borrowing at ${pct(rows[0].borrow)}; as a package, ${pct(rows[1].lend)} and ${pct(rows[1].borrow)}.`}
      plotHeight={HEIGHT}
      plot={plot}
      controls={
        <Segmented label="Strikes" value={box} onChange={setBox} options={[
          { value: '95/105', label: '95 / 105 box' },
          { value: '90/110', label: '90 / 110 box' },
          { value: '80/120', label: '80 / 120 box' },
        ]} />
      }
      readout={
        <>
          <table className="iter-table">
            <thead><tr><th style={{ textAlign: 'left' }}>Leg</th><th>Bid</th><th>Ask</th></tr></thead>
            <tbody>
              {legs.map((l, i) => (
                <tr key={i}><td style={{ textAlign: 'left' }}>{l.qty > 0 ? 'Buy' : 'Sell'} {l.strike} {l.type}</td><td>{l.bid.toFixed(2)}</td><td>{l.ask.toFixed(2)}</td></tr>
              ))}
            </tbody>
          </table>
          <p>
            Pays <strong>${width}</strong> at expiry, worth <span className="num">{m.theo.toFixed(4)}</span> today at 5%.
            Leg by leg: <span className="num">{m.bid.toFixed(2)} / {m.ask.toFixed(2)}</span>. As a package: <span className="num">{c.bid.toFixed(2)} / {c.ask.toFixed(2)}</span>.
          </p>
          <p className="muted">Buying the box lends ${width} × e^(−rT) and gets ${width} back; selling it borrows. Net delta and vega are exactly zero.</p>
        </>
      }
      caption="Three-month European options on the \$100 stock, quoted as in Chapter 45. Long the lower-strike call and the higher-strike put, short the other two. At expiry the box pays the difference between the strikes in every scenario."
    />
  );
}
