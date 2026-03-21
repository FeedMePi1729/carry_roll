import { useRef, useEffect } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

function Math({ tex, display = false }: { tex: string; display?: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (ref.current) {
      katex.render(tex, ref.current, { displayMode: display, throwOnError: false });
    }
  }, [tex]);
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

      {/* Section 1: Z-Spread Mode */}
      <div className={sectionCls}>
        <h3 className={headingCls}>Z-Spread Mode (4 Components)</h3>
        <p className={textCls}>
          Separates P&L into carry (time value), pull-to-par (maturity convergence), roll-down (curve shape benefit),
          and spread change (credit repricing). This mode prices the bond off the bootstrapped government zero curve
          plus a Z-spread, providing maximum decomposition granularity. The Z-spread is calibrated so that
          P₀ exactly matches the observed (YTM-derived) dirty price — there is no base pricing error.
        </p>

        <div className="mt-4 space-y-3">
          <h4 className={subHeadingCls}>What is the Z-Spread?</h4>
          <p className={textCls}>
            The Z-spread (zero-volatility spread) is the constant spread <Math tex="Z" /> added to each bootstrapped
            zero rate such that the present value of all cashflows equals the observed market price:
          </p>
          <BlockMath tex="P_0 = \sum_i \text{CF}_i \cdot e^{-\left(z(\tau_i) + Z\right) \cdot \tau_i}" />
          <p className={textCls}>
            Unlike the G-spread (which is simply <Math tex="\text{YTM} - \text{par\_yield}(T)" /> and ignores curve shape),
            the Z-spread is solved numerically (Brent's method) to calibrate exactly to the observed price.
          </p>

          <h4 className={subHeadingCls}>Intermediate Prices</h4>
          <div className={`${textCls} space-y-2`}>
            <div className="flex items-start gap-3">
              <span className="shrink-0 w-16 font-mono text-sm">P₀</span>
              <span>Current dirty price at settlement <Math tex="t" />, Z-spread <Math tex="Z_t" /> — exact by construction</span>
            </div>
            <div className="flex items-start gap-3">
              <span className="shrink-0 w-16 font-mono text-sm">P_ptp</span>
              <span>Aged dirty price at <Math tex="t{+}\Delta t" />, same Z-spread <Math tex="Z_t" /> — price convergence reference</span>
            </div>
            <div className="flex items-start gap-3">
              <span className="shrink-0 w-16 font-mono text-sm">P_rd</span>
              <span>Aged at <Math tex="t{+}\Delta t" />, <em>rolled</em> Z-spread <Math tex="Z_{rd}" /> — curve roll reference</span>
            </div>
            <div className="flex items-start gap-3">
              <span className="shrink-0 w-16 font-mono text-sm">P₂</span>
              <span>Aged at <Math tex="t{+}\Delta t" />, final Z-spread <Math tex="Z_{t+\Delta t}" /> (= <Math tex="Z_{rd}" /> if no override)</span>
            </div>
            <div className="flex items-start gap-3">
              <span className="shrink-0 w-16 font-mono text-sm">CF</span>
              <span>Cash flows received in <Math tex="(t,\; t + \Delta t]" /></span>
            </div>
          </div>

          <h4 className={subHeadingCls}>Roll-Down Spread Calculation</h4>
          <p className={textCls}>
            The rolled Z-spread preserves the bond's total discount rate (zero rate + Z-spread) at the current
            maturity, expressed as a Z-spread at the new (shorter) maturity:
          </p>
          <BlockMath tex="z_T = \text{zero\_rate}(T),\quad z_{T-\Delta t} = \text{zero\_rate}(T - \Delta t)" />
          <BlockMath tex="Z_{rd} = Z_t + \bigl(z_{T-\Delta t} - z_T\bigr)" />
          <p className={textCls}>
            On an upward-sloping curve, <Math tex="z_{T-\Delta t} < z_T" />, so <Math tex="Z_{rd} < Z_t" />.
            A lower Z-spread raises the price, generating positive roll-down.
          </p>

          <h4 className={subHeadingCls}>Decomposition Formulas</h4>
          <BlockMath tex="\text{Carry} = \text{CF}" />
          <BlockMath tex="\text{Pull to Par} = P_\text{ptp} - P_0" />
          <BlockMath tex="\text{Roll-Down} = P_{rd} - P_\text{ptp}" />
          <BlockMath tex="\Delta\text{Spread} = P_2 - P_{rd} \quad (= 0 \text{ if no override})" />
          <BlockMath tex="\boxed{\text{Total} = \text{Carry} + \text{Pull to Par} + \text{Roll-Down} + \Delta\text{Spread} = P_2 - P_0 + \text{CF}}" />

          <div className={insightCls}>
            <p className="text-sm font-medium text-indigo-800 dark:text-indigo-300">Key Insight</p>
            <p className={`${textCls} mt-1`}>
              <strong>Carry</strong> is the coupon income received. <strong>Pull to Par</strong> is the dirty
              price change at unchanged Z-spread — it captures coupon accrual and par convergence.
              <strong>Roll-Down</strong> is the extra price gain from the bond's Z-spread naturally narrowing
              as it slides to a shorter tenor on an upward-sloping curve. By default (no override), the
              spread at <Math tex="t{+}\Delta t" /> is the naturally rolled spread, so <Math tex="\Delta\text{Spread} = 0" />.
              The decomposition is <strong>exact</strong> — P₀ is calibrated to the observed price,
              and the identity holds with near-zero residual.
            </p>
          </div>
        </div>
      </div>

      {/* Section 2: Yield Mode */}
      <div className={sectionCls}>
        <h3 className={headingCls}>Yield Mode (4 Components)</h3>
        <p className={textCls}>
          Same mechanical split as Z-Spread mode, but uses flat-yield (YTM) pricing throughout.
          The roll-down is computed using the par treasury curve instead of the zero curve.
        </p>

        <div className="mt-4 space-y-3">
          <h4 className={subHeadingCls}>Roll-Down YTM Calculation</h4>
          <BlockMath tex="y_T = \text{par\_yield}(T),\quad y_{T-\Delta t} = \text{par\_yield}(T - \Delta t)" />
          <BlockMath tex="\text{bond\_excess} = \bar{y} - y_T \quad(\text{= g-spread})" />
          <BlockMath tex="y_{rd} = y_{T-\Delta t} + \text{bond\_excess}" />

          <h4 className={subHeadingCls}>Pricing Function</h4>
          <p className={textCls}>Flat-yield pricing uses standard bond compounding:</p>
          <BlockMath tex="P = \sum_i \frac{\text{CF}_i}{\left(1 + \bar{y}/f\right)^{f \cdot \tau_i}}" />
          <p className={textCls}>where <Math tex="f" /> is the coupon frequency.</p>

          <h4 className={subHeadingCls}>Decomposition Formulas</h4>
          <BlockMath tex="\text{Carry} = \text{CF}" />
          <BlockMath tex="\text{Pull to Par} = P_\text{ptp} - P_0" />
          <BlockMath tex="\text{Roll-Down} = P_{rd} - P_\text{ptp}" />
          <BlockMath tex="\Delta\text{Yield} = P_2 - P_{rd} \quad (= 0 \text{ if no override})" />
          <BlockMath tex="\boxed{\text{Total} = \text{Carry} + \text{Pull to Par} + \text{Roll-Down} + \Delta\text{Yield} = P_2 - P_0 + \text{CF}}" />

          <div className={insightCls}>
            <p className="text-sm font-medium text-indigo-800 dark:text-indigo-300">Key Insight</p>
            <p className={`${textCls} mt-1`}>
              Yield Mode uses the same structure as Z-Spread Mode, but prices all bonds at flat YTM
              and rolls down the par treasury curve rather than the zero curve. The carry + pull_to_par
              together equal the old "Carry (incl. roll)" from the 2-component formulation.
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
                <th className="pb-2 pr-4">Z-Spread Mode</th>
                <th className="pb-2">Yield Mode</th>
              </tr>
            </thead>
            <tbody className="text-gray-700 dark:text-gray-300">
              <tr className="border-b border-gray-100 dark:border-gray-700">
                <td className="py-2 pr-4 font-medium">Components</td>
                <td className="py-2 pr-4">4 (Carry, Pull to Par, Roll-Down, <Math tex="\Delta Z" />)</td>
                <td className="py-2">4 (Carry, Pull to Par, Roll-Down, <Math tex="\Delta \bar{y}" />)</td>
              </tr>
              <tr className="border-b border-gray-100 dark:border-gray-700">
                <td className="py-2 pr-4 font-medium">Carry definition</td>
                <td className="py-2 pr-4">Coupon income only (CF)</td>
                <td className="py-2">Same — coupon income only (CF)</td>
              </tr>
              <tr className="border-b border-gray-100 dark:border-gray-700">
                <td className="py-2 pr-4 font-medium">Roll-Down reference</td>
                <td className="py-2 pr-4">Bootstrapped zero curve</td>
                <td className="py-2">Par treasury curve</td>
              </tr>
              <tr className="border-b border-gray-100 dark:border-gray-700">
                <td className="py-2 pr-4 font-medium">Pricing basis</td>
                <td className="py-2 pr-4">Gov zero curve + Z-spread (<Math tex="e^{-(z+Z)\tau}" />), calibrated to price</td>
                <td className="py-2">Flat YTM (<Math tex="(1+\bar{y}/f)^{-f\tau}" />)</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-medium">Use case</td>
                <td className="py-2 pr-4">Exact pricing, isolate curve vs spread vs maturity effects</td>
                <td className="py-2">Simple carry analysis with explicit pull-to-par</td>
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
            The <strong>"New Z-Spread"</strong> and <strong>"New YTM"</strong> inputs let you specify a
            hypothetical scenario for the spread or yield at <Math tex="t + \Delta t" />.
          </p>
          <p>
            If left at the current value, the spread/yield change component will be zero —
            showing only carry, pull-to-par, and roll-down earned from holding the bond.
            Changing the value lets you answer: <em>"What if spreads widen by 50 bps?"</em>
          </p>
          <p>
            The <strong>Time Evolution</strong> chart shows how P&L accumulates over multiple horizons
            (<Math tex="\Delta t" /> = 1d, 7d, 30d, 90d, 180d, 1y) under the same scenario assumptions.
          </p>
        </div>
      </div>

      {/* Section 5: Curve Roll Visualisation */}
      <div className={sectionCls}>
        <h3 className={headingCls}>Curve Roll Visualisation</h3>
        <div className={`${textCls} space-y-3`}>
          <p>
            On the <strong>Curves</strong> tab, selecting a roll horizon shows each bond rolled forward
            by the chosen period. Hollow markers appear at the rolled positions; dotted arrows connect
            current to rolled positions (green = positive roll-down, red = negative).
          </p>
          <p>
            Hovering over a ghost marker shows the full P&L breakdown (carry, pull-to-par, roll-down)
            for that bond over the selected horizon. The stats table below the chart gains columns
            for rolled maturity, rolled YTM, and all decomposition components.
          </p>
          <p>
            The <strong>spread change</strong> component is excluded from the curve roll view since no
            spread override is applied — only the natural roll-down from the curve shape is shown.
          </p>
        </div>
      </div>
    </div>
  );
}
