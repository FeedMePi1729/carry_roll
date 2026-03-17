import { useRef, useEffect } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

function Math({ tex, display = false }: { tex: string; display?: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (ref.current) {
      katex.render(tex, ref.current, { displayMode: display, throwOnError: false });
    }
  }, [tex, display]);
  return <span ref={ref} />;
}

function BlockMath({ tex }: { tex: string }) {
  return (
    <div className="my-2 overflow-x-auto text-center">
      <Math tex={tex} display />
    </div>
  );
}

export default function DecompositionDocs() {
  const sectionCls = "bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5";
  const headingCls = "text-lg font-semibold mb-3";
  const subHeadingCls = "text-sm font-semibold mb-2 text-indigo-600 dark:text-indigo-400";
  const textCls = "text-sm text-gray-700 dark:text-gray-300 leading-relaxed";
  const insightCls = "mt-3 border-l-4 border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 rounded-r-lg p-3";

  return (
    <div className="space-y-6 max-w-4xl">
      <h2 className="text-xl font-bold">P&L Decomposition Methodology</h2>

      {/* Section 1: G-Spread Mode */}
      <div className={sectionCls}>
        <h3 className={headingCls}>G-Spread Mode (3 Components)</h3>
        <p className={textCls}>
          Separates P&L into carry (time value), roll-down (curve shape benefit), and spread change
          (credit repricing). This mode prices the bond off the government yield curve plus a g-spread,
          allowing isolation of the roll-down effect.
        </p>

        <div className="mt-4 space-y-3">
          <h4 className={subHeadingCls}>Price Definitions</h4>
          <div className={`${textCls} space-y-2`}>
            <div className="flex items-start gap-3">
              <span className="shrink-0 w-16"><Math tex="P_0" /></span>
              <span>Current dirty price, priced off the gov zero curve <Math tex="y^G_t" /> plus current g-spread <Math tex="g_t" /></span>
            </div>
            <div className="flex items-start gap-3">
              <span className="shrink-0 w-16"><Math tex="P_\text{flat}" /></span>
              <span>Current dirty price at a flat YTM <Math tex="\bar{y}_t" /> (equal to the bond's current yield)</span>
            </div>
            <div className="flex items-start gap-3">
              <span className="shrink-0 w-16"><Math tex="P_f" /></span>
              <span>Aged dirty price at the same flat YTM <Math tex="\bar{y}_t" /> (the carry reference price at <Math tex="t + \Delta t" />)</span>
            </div>
            <div className="flex items-start gap-3">
              <span className="shrink-0 w-16"><Math tex="P_1" /></span>
              <span>Aged dirty price at same gov curve <Math tex="y^G_t" /> plus same g-spread <Math tex="g_t" /></span>
            </div>
            <div className="flex items-start gap-3">
              <span className="shrink-0 w-16"><Math tex="P_2" /></span>
              <span>Aged dirty price at same gov curve <Math tex="y^G_t" /> plus new g-spread <Math tex="g_{t+\Delta t}" /></span>
            </div>
            <div className="flex items-start gap-3">
              <span className="shrink-0 w-16"><Math tex="\text{CF}" /></span>
              <span>Cash flows received in <Math tex="[t,\; t + \Delta t]" /></span>
            </div>
          </div>

          <h4 className={subHeadingCls}>Pricing Function</h4>
          <p className={textCls}>
            For curve-based pricing, each cashflow at time <Math tex="\tau_i" /> from settlement is discounted using
            the bootstrapped zero rate plus the g-spread:
          </p>
          <BlockMath tex="P = \sum_i \text{CF}_i \cdot e^{-\left(z(\tau_i) + g\right) \cdot \tau_i}" />
          <p className={textCls}>
            where <Math tex="z(\tau_i)" /> is the interpolated zero rate from the government curve.
            For flat-yield pricing, the standard bond pricing formula applies:
          </p>
          <BlockMath tex="P = \sum_i \frac{\text{CF}_i}{\left(1 + \bar{y}/f\right)^{f \cdot \tau_i}}" />
          <p className={textCls}>where <Math tex="f" /> is the coupon frequency (typically 2 for semi-annual).</p>

          <h4 className={subHeadingCls}>Decomposition Formulas</h4>
          <BlockMath tex="\text{Carry} = P_f - P_\text{flat} + \text{CF}" />
          <BlockMath tex="\text{Roll} = (P_1 - P_0) - (P_f - P_\text{flat})" />
          <BlockMath tex="\Delta\text{Spread} = P_2 - P_1" />
          <BlockMath tex="\boxed{\text{Total} = \text{Carry} + \text{Roll} + \Delta\text{Spread} = P_2 - P_0 + \text{CF}}" />

          <div className={insightCls}>
            <p className="text-sm font-medium text-indigo-800 dark:text-indigo-300">Key Insight</p>
            <p className={`${textCls} mt-1`}>
              Carry here <strong>excludes</strong> roll-down. It measures pure time passage at a flat yield.
              The roll-down component captures the additional P&L from the bond "rolling down" the
              non-flat government yield curve. The decomposition is <strong>exact</strong> &mdash; carry + roll + spread change
              equals the total P&L with zero residual.
            </p>
          </div>
        </div>
      </div>

      {/* Section 2: Yield Mode */}
      <div className={sectionCls}>
        <h3 className={headingCls}>Yield Mode (2 Components)</h3>
        <p className={textCls}>
          Simpler decomposition using only the bond's flat yield (YTM). Roll-down is embedded in carry.
        </p>

        <div className="mt-4 space-y-3">
          <h4 className={subHeadingCls}>Price Definitions</h4>
          <div className={`${textCls} space-y-2`}>
            <div className="flex items-start gap-3">
              <span className="shrink-0 w-16"><Math tex="P_0" /></span>
              <span>Current dirty price at current YTM <Math tex="\bar{y}_t" /></span>
            </div>
            <div className="flex items-start gap-3">
              <span className="shrink-0 w-16"><Math tex="P_1" /></span>
              <span>Aged dirty price at same YTM <Math tex="\bar{y}_t" /> (time passes, yield stays flat)</span>
            </div>
            <div className="flex items-start gap-3">
              <span className="shrink-0 w-16"><Math tex="P_2" /></span>
              <span>Aged dirty price at new YTM <Math tex="\bar{y}_{t+\Delta t}" /></span>
            </div>
            <div className="flex items-start gap-3">
              <span className="shrink-0 w-16"><Math tex="\text{CF}" /></span>
              <span>Cash flows received in <Math tex="[t,\; t + \Delta t]" /></span>
            </div>
          </div>

          <h4 className={subHeadingCls}>Decomposition Formulas</h4>
          <BlockMath tex="\text{Carry (incl. roll)} = P_1 - P_0 + \text{CF}" />
          <BlockMath tex="\Delta\text{Yield} = P_2 - P_1" />
          <BlockMath tex="\boxed{\text{Total} = \text{Carry (incl. roll)} + \Delta\text{Yield} = P_2 - P_0 + \text{CF}}" />

          <div className={insightCls}>
            <p className="text-sm font-medium text-indigo-800 dark:text-indigo-300">Key Insight</p>
            <p className={`${textCls} mt-1`}>
              Carry here <strong>includes</strong> roll-down. It equals carry + roll from G-spread mode.
              This is the simpler view commonly used when you only care about "what do I earn from
              holding this bond" vs "what happens if yields change."
            </p>
          </div>
        </div>
      </div>

      {/* Section 3: Comparison Table */}
      <div className={sectionCls}>
        <h3 className={headingCls}>Comparison</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-600">
                <th className="pb-2 pr-4">Aspect</th>
                <th className="pb-2 pr-4">G-Spread Mode</th>
                <th className="pb-2">Yield Mode</th>
              </tr>
            </thead>
            <tbody className="text-gray-700 dark:text-gray-300">
              <tr className="border-b border-gray-100 dark:border-gray-700">
                <td className="py-2 pr-4 font-medium">Components</td>
                <td className="py-2 pr-4">3 (Carry, Roll, <Math tex="\Delta g" />)</td>
                <td className="py-2">2 (Carry incl. roll, <Math tex="\Delta \bar{y}" />)</td>
              </tr>
              <tr className="border-b border-gray-100 dark:border-gray-700">
                <td className="py-2 pr-4 font-medium">Carry includes roll?</td>
                <td className="py-2 pr-4">No</td>
                <td className="py-2">Yes</td>
              </tr>
              <tr className="border-b border-gray-100 dark:border-gray-700">
                <td className="py-2 pr-4 font-medium">Pricing basis</td>
                <td className="py-2 pr-4">Gov zero curve + g-spread (<Math tex="e^{-(z+g)\tau}" />)</td>
                <td className="py-2">Flat YTM (<Math tex="(1+\bar{y}/f)^{-f\tau}" />)</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-medium">Use case</td>
                <td className="py-2 pr-4">Isolate curve vs spread effects</td>
                <td className="py-2">Simple carry analysis</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 4: Override Inputs */}
      <div className={sectionCls}>
        <h3 className={headingCls}>Override Inputs &amp; Time Evolution</h3>
        <div className={`${textCls} space-y-3`}>
          <p>
            The <strong>"New G-Spread"</strong> and <strong>"New YTM"</strong> inputs let you specify a
            hypothetical scenario for the spread or yield at <Math tex="t + \Delta t" />.
          </p>
          <p>
            If left at the current value, the spread/yield change component will be zero &mdash;
            showing only the carry (and roll-down in G-spread mode) earned from holding the bond.
            Changing the value lets you answer: <em>"What if spreads widen by 50 bps?"</em>
          </p>
          <p>
            The <strong>Time Evolution</strong> chart shows how P&L accumulates over multiple horizons
            (<Math tex="\Delta t" /> = 1d, 7d, 30d, 90d, 180d, 1y) under the same scenario assumptions.
            This reveals the term structure of carry and the impact of spread/yield changes at
            different holding periods.
          </p>
        </div>
      </div>
    </div>
  );
}
