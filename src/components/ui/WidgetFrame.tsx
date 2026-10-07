import type { ReactNode } from 'react';
import { RichText } from './Tex';

interface WidgetFrameProps {
  title: string;
  /** Plain-language summary for screen readers. */
  ariaLabel: string;
  /** Height of the plot area in px (reserved before hydration to avoid layout shift). */
  plotHeight: number;
  plot: ReactNode;
  controls?: ReactNode;
  readout?: ReactNode;
  caption?: string;
}

/** Common card around every interactive figure: title, plot, controls, readout, caption. */
export function WidgetFrame({ title, ariaLabel, plotHeight, plot, controls, readout, caption }: WidgetFrameProps) {
  return (
    <figure className="widget">
      <figcaption className="widget-title">{title}</figcaption>
      <div className="widget-body">
        <div className="widget-plot" role="img" aria-label={ariaLabel} style={{ minHeight: plotHeight }}>
          {plot}
        </div>
        {(controls || readout) && (
          <div className="widget-side">
            {controls && <div className="widget-controls">{controls}</div>}
            {readout && <div className="widget-readout" aria-live="polite">{readout}</div>}
          </div>
        )}
      </div>
      {caption && <p className="widget-caption"><RichText>{caption}</RichText></p>}
    </figure>
  );
}
