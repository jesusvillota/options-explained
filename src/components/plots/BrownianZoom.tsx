import { Polyline } from 'mafs';
import { useMemo, useState } from 'react';
import { brownianPath } from '../../lib/math/brownian';
import { Button, Slider } from '../ui/controls';
import { WidgetFrame } from '../ui/WidgetFrame';
import { PlotFrame } from './PlotFrame';

const N = 2 ** 15;
const HEIGHT = 280;

/**
 * Chapter 15: zoom into a Brownian path. Shrink time by z and stretch values
 * by √z: the path looks just as rough. Brownian motion is self-similar.
 */
export default function BrownianZoom() {
  const [zoomPow, setZoomPow] = useState(0);
  const [seed, setSeed] = useState(3);
  const path = useMemo(() => brownianPath(seed, N, 1), [seed]);
  const z = 4 ** zoomPow;
  const tMax = 1 / z;
  const scale = Math.sqrt(tMax);
  const count = Math.floor(N / z);
  const stride = Math.max(1, Math.floor(count / 1500));
  const pts: [number, number][] = [];
  for (let i = 0; i <= count; i += stride) pts.push([i / N, path[i]]);

  return (
    <WidgetFrame
      title="Zooming into Brownian motion"
      ariaLabel={`A Brownian path on [0, ${tMax}] with the vertical axis scaled by √${tMax}: it looks as rough as the full path.`}
      plotHeight={HEIGHT}
      plot={
        <PlotFrame x={[0, tMax]} y={[-3 * scale, 3 * scale]} height={HEIGHT} xTicks={[0, tMax / 2, tMax]} yTicks={[-2 * scale, 0, 2 * scale]} formatX={(t) => (t === 0 ? '0' : t.toPrecision(2))} formatY={(v) => (v === 0 ? '0' : v.toPrecision(2))} baseline={0} yLabel="W(t)">
          <Polyline points={pts} color="var(--c-spot)" weight={1.4} fillOpacity={0} />
        </PlotFrame>
      }
      controls={
        <>
          <Slider label="Zoom into time" value={zoomPow} min={0} max={6} onChange={setZoomPow} format={(v) => `×${4 ** v}`} color="var(--c-time)" />
          <Button onClick={() => setSeed((s) => s + 1)}>New path</Button>
        </>
      }
      readout={
        <p>
          Showing t from 0 to {tMax.toPrecision(3)} (zoomed ×{z} in time) with the vertical axis zoomed ×{Math.sqrt(z)} (= √{z}). However far you zoom, it never
          smooths out.
        </p>
      }
      caption="A smooth curve would look like a straight line under enough magnification. Brownian motion never does: zooming time by z and values by √z gives a path that's statistically identical."
    />
  );
}
