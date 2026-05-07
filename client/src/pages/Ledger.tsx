import { BEANS_DATA } from "../lib/data";
import { acctColor } from "../lib/format";
import { Card, Btn } from "../components/ui";

export default function LedgerPage() {
  const { transactions } = BEANS_DATA;
  const sample = transactions.slice(0, 20);

  return (
    <div className="p-7 space-y-5 max-w-[1400px]">
      <Card className="p-3 flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-wider text-neutral-500 font-medium px-2">Beancount Source</span>
        <div className="ml-auto flex items-center gap-2">
          <Btn variant="ghost">↓ Export</Btn>
          <Btn variant="ghost">⌘K Query</Btn>
          <Btn variant="primary">Reload</Btn>
        </div>
      </Card>
      <Card className="p-6 font-mono text-[13px] leading-relaxed">
        <div className="text-neutral-600 mb-4">
          <div>; -*- mode: beancount -*-</div>
          <div>; beans ledger · exported May 7, 2026</div>
          <div>option "title" "kevin's books"</div>
          <div>option "operating_currency" "USD"</div>
        </div>
        <div className="space-y-5">
          {sample.map((t) => (
            <div key={t.id}>
              <div>
                <span className="text-sky-400">{t.date}</span>
                {" "}
                <span className="text-amber-400">{t.flag}</span>
                {t.payee && (
                  <> {" "}<span className="text-emerald-400">"{t.payee}"</span></>
                )}
                {" "}
                <span className="text-neutral-300">"{t.narration}"</span>
                {t.tags.map((tag) => (
                  <span key={tag} className="text-violet-400"> #{tag}</span>
                ))}
              </div>
              {t.postings.map((p, i) => {
                const c = acctColor(p.account);
                const n = parseFloat(p.units.number);
                return (
                  <div key={i} className="pl-4">
                    <span className={c.text}>{p.account}</span>
                    <span className={`tabular-nums ${n >= 0 ? "text-neutral-200" : "text-rose-300"}`}>
                      {"  "}{n >= 0 ? " " : ""}{n.toFixed(2)} {p.units.currency}
                    </span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
