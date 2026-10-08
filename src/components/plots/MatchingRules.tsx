import { Polygon } from 'mafs';
import { useState } from 'react';
import { RULES, type RuleName } from '../../lib/micro/matching';
import type { Order } from '../../lib/micro/orderBook';
import { Segmented, Slider } from '../ui/controls';
import { WidgetFrame } from '../ui/WidgetFrame';
import { Label, PlotFrame } from './PlotFrame';

type Arrival = 'first' | 'last';
type Role = 'mm' | 'customer';
const HEIGHT = 300;
const X_MAX = 62;

const OTHERS: { size: number; owner: string; name: string }[] = [
  { size: 20, owner: 'mm', name: 'Market maker A' },
  { size: 5, owner: 'customer', name: 'Public customer' },
  { size: 30, owner: 'lmm', name: 'Lead market maker' },
  { size: 40, owner: 'mm', name: 'Market maker B' },
];

const RULE_TEXT: Record<RuleName, string> = {
  priceTime: 'Price–time: whoever arrived first fills first, in full.',
  proRata: 'Pro-rata: everyone at the price gets the same fraction of their size; time only breaks rounding ties.',
  customer: 'Public customers fill first, in time order; professionals share the rest pro rata.',
  lmm: 'Customers first, then the lead market maker takes 40% of what is left, then the rest is shared pro rata.',
};

function buildLevel(yourSize: number, arrival: Arrival, role: Role): { orders: Order[]; names: string[]; you: number } {
  const others = OTHERS.map((o, i) => ({ order: { id: i + 1, side: 'bid' as const, price: 2.4, size: o.size, owner: o.owner }, name: o.name }));
  const you = { order: { id: 9, side: 'bid' as const, price: 2.4, size: yourSize, owner: role }, name: role === 'customer' ? 'You (public customer)' : 'You (professional)' };
  const rows = arrival === 'first' ? [you, ...others] : [...others, you];
  return { orders: rows.map((r) => r.order), names: rows.map((r) => r.name), you: arrival === 'first' ? 0 : rows.length - 1 };
}

/**
 * Chapter 44: one incoming sell order hits five bids resting at the same
 * price. The matching rule decides who gets what. Bars are listed in arrival
 * order; the dark part of each bar is what that order fills.
 */
export default function MatchingRules({ title = 'Who gets filled? Five bids at 2.40' }: { title?: string }) {
  const [rule, setRule] = useState<RuleName>('priceTime');
  const [incoming, setIncoming] = useState(30);
  const [yourSize, setYourSize] = useState(10);
  const [arrival, setArrival] = useState<Arrival>('last');
  const [role, setRole] = useState<Role>('mm');

  const { orders, names, you } = buildLevel(yourSize, arrival, role);
  const shares = RULES[rule](orders, incoming);
  const total = orders.reduce((a, o) => a + o.size, 0);
  const yourFill = shares[you];
  const alt = (size: number, arr: Arrival) => {
    const l = buildLevel(size, arr, role);
    return RULES[rule](l.orders, incoming)[l.you];
  };
  const otherArrival: Arrival = arrival === 'first' ? 'last' : 'first';
  const ifOtherArrival = alt(yourSize, otherArrival);
  const ifDouble = alt(Math.min(yourSize * 2, 60), arrival);
  const rowY = (i: number) => orders.length - i;

  const plot = (
    <PlotFrame
      x={[0, X_MAX]}
      y={[0.35, orders.length + 0.75]}
      height={HEIGHT}
      xTicks={[0, 10, 20, 30, 40, 50, 60]}
      yTicks={[]}
      xLabel="contracts bid at 2.40"
      marginLeft={14}
    >
      {orders.map((o, i) => {
        const y = rowY(i);
        const isYou = i === you;
        const color = isYou ? 'var(--text)' : 'var(--c-bid)';
        const h = 0.2;
        return (
          <g key={o.id}>
            <Polygon points={[[0, y - h], [o.size, y - h], [o.size, y + h], [0, y + h]]} color={color} fillOpacity={0.15} strokeOpacity={0.7} weight={1} />
            {shares[i] > 0 && <Polygon points={[[0, y - h], [shares[i], y - h], [shares[i], y + h], [0, y + h]]} color={color} fillOpacity={0.75} strokeOpacity={0} />}
            <Label x={0} y={y + h} attach="ne" attachDistance={3} size={12} color={isYou ? 'var(--text)' : 'var(--text-muted)'}>
              {`${i + 1}. ${names[i]}`}
            </Label>
            <Label x={o.size} y={y} attach="e" attachDistance={6} size={12} color={shares[i] > 0 ? 'var(--text)' : 'var(--text-muted)'}>
              {`${shares[i]} of ${o.size}`}
            </Label>
          </g>
        );
      })}
    </PlotFrame>
  );

  return (
    <WidgetFrame
      title={title}
      ariaLabel={`A market sell of ${incoming} contracts hits five bids at 2.40 under the ${rule} rule. Your order of ${yourSize} gets ${yourFill}.`}
      plotHeight={HEIGHT}
      plot={plot}
      controls={
        <>
          <Segmented label="Matching rule" value={rule} onChange={setRule} options={[
            { value: 'priceTime', label: 'Price–time' },
            { value: 'proRata', label: 'Pro-rata' },
            { value: 'customer', label: 'Customers first' },
            { value: 'lmm', label: 'Lead MM 40%' },
          ]} />
          <Slider label="Incoming market sell" value={incoming} min={1} max={150} step={1} onChange={setIncoming} format={(v) => `${v} contracts`} color="var(--c-ask)" />
          <Slider label="Your bid size" value={yourSize} min={5} max={60} step={5} onChange={setYourSize} color="var(--c-bid)" />
          <Segmented label="You arrived" value={arrival} onChange={setArrival} options={[
            { value: 'first', label: 'You arrived first' },
            { value: 'last', label: 'You arrived last' },
          ]} />
          <Segmented label="You are" value={role} onChange={setRole} options={[
            { value: 'mm', label: 'Professional' },
            { value: 'customer', label: 'Public customer' },
          ]} />
        </>
      }
      readout={
        <>
          <p>{RULE_TEXT[rule]}</p>
          <p>
            <strong>You get {yourFill} of your {yourSize}</strong> <span className="muted">({Math.round((100 * yourFill) / yourSize)}% filled, against {Math.round((100 * Math.min(incoming, total)) / total)}% of all the size at this price).</span>
          </p>
          <p className="muted">
            Had you arrived {otherArrival}: {ifOtherArrival}. Had you bid {Math.min(yourSize * 2, 60)} instead: {ifDouble}.
          </p>
        </>
      }
      caption="Each bar is a bid resting at 2.40, listed in the order it arrived. The dark part is what it fills when the market sell arrives. Change the rule and see what each one rewards: speed, size, or who you are."
    />
  );
}
