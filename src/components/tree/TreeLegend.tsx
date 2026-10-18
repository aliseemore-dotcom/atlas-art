/** «Как читать древо»: обязательна на каждой странице древа (дизайн-система). */
export function TreeLegend() {
  const row = "flex items-center gap-3";
  return (
    <section aria-labelledby="legend-h" className="border border-line bg-cream p-4">
      <h2 id="legend-h" className="label text-wine">КАК ЧИТАТЬ ДРЕВО</h2>
      <ul className="mt-3 grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
        <li className={row}>
          <svg width="48" height="20" aria-hidden><line x1="0" y1="10" x2="48" y2="10" stroke="#930400" strokeWidth="2" /></svg>
          <span>учитель → ученик (сверху вниз)</span>
        </li>
        <li className={row}>
          <svg width="48" height="20" aria-hidden><line x1="0" y1="10" x2="48" y2="10" stroke="#930400" strokeWidth="2" strokeDasharray="6 6" /></svg>
          <span>влияние, последователь</span>
        </li>
        <li className={row}>
          <svg width="48" height="20" aria-hidden><line x1="0" y1="10" x2="48" y2="10" stroke="#95baeb" strokeWidth="4" /></svg>
          <span>два учителя одного ученика</span>
        </li>
        <li className={row}>
          <svg width="48" height="20" aria-hidden><line x1="0" y1="10" x2="48" y2="10" stroke="#7a4a44" strokeWidth="1" /></svg>
          <span>работали вместе</span>
        </li>
        <li className={row}>
          <span aria-hidden className="inline-block h-6 w-5 rounded-[50%] bg-wine" /><span>мастер ветви</span>
        </li>
        <li className={row}>
          <span aria-hidden className="inline-block h-6 w-5 rounded-[50%] border-2 border-wine bg-milk" /><span>учитель</span>
        </li>
        <li className={row}>
          <span aria-hidden className="inline-block h-6 w-5 rounded-[50%] border border-wine bg-heavenly" /><span>ученик, последователь</span>
        </li>
        <li className="sm:col-span-2">Совпадение лет жизни связью не считается: на древе только связи с указанным статусом.</li>
      </ul>
    </section>
  );
}
