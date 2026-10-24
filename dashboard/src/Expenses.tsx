import { useEffect, useMemo, useState, type FormEvent } from "react";
import { addExpense, getExpenses } from "./data";
import type { DashExpense, ExpenseCategory } from "./types";
import { money, day } from "./format";
import { Empty } from "./components";

const CATS: Record<ExpenseCategory, string> = { food: "Food purchases", transport: "Transport/fuel", facility: "Facility", supplies: "Supplies", staff: "Staff/stipends", other: "Other" };

export function Expenses() {
  const [rows, setRows] = useState<DashExpense[] | null>(null);
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<ExpenseCategory>("food");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [err, setErr] = useState("");
  const [done, setDone] = useState("");
  useEffect(() => { getExpenses().then(setRows); }, []);

  const totals = useMemo(() => {
    const t = new Map<ExpenseCategory, number>();
    (rows ?? []).forEach((r) => t.set(r.category, (t.get(r.category) ?? 0) + r.amount));
    return [...t.entries()].sort((a, b) => b[1] - a[1]);
  }, [rows]);
  if (!rows) return <p className="loading">Loading…</p>;
  const total = rows.reduce((s, r) => s + r.amount, 0);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const dollars = Number(amount);
    if (!Number.isFinite(dollars) || dollars <= 0) { setErr("Enter an amount greater than zero."); return; }
    setErr("");
    await addExpense({ date: new Date(date + "T12:00:00").getTime(), amount: Math.round(dollars * 100), category, note: note.trim() || undefined });
    setRows(await getExpenses());
    setDone(`Added ${money(Math.round(dollars * 100))} for ${CATS[category]}.`);
    setAmount(""); setNote("");
  }

  return (
    <section aria-labelledby="h-exp">
      <h2 id="h-exp">Expenses</h2>
      <form className="addform" onSubmit={submit} noValidate>
        <label>Date<input type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></label>
        <label>Amount ($)<input inputMode="decimal" value={amount} onChange={(e) => { setAmount(e.target.value); setDone(""); }} placeholder="0.00" aria-invalid={!!err} aria-describedby={err ? "amt-err" : undefined} /></label>
        <label>Category<select value={category} onChange={(e) => setCategory(e.target.value as ExpenseCategory)}>{Object.entries(CATS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <label className="grow">Note<input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" /></label>
        <button className="primary" type="submit">Add expense</button>
        {err && <p className="err" id="amt-err" role="alert">{err}</p>}
        <p className="ok" role="status">{done}</p>
      </form>

      {rows.length === 0 ? <Empty title="No expenses yet">Add the first one above. Cost per meal on the overview needs them.</Empty> : (
        <>
          <h3>Where the money went <span className="tag tag-rec">Record</span></h3>
          <ul className="bars">
            {totals.map(([c, v]) => (
              <li key={c}><span className="bar-label">{CATS[c]}</span>
                <span className="bar" aria-hidden="true"><span style={{ width: (v / total) * 100 + "%" }} /></span>
                <span className="bar-val rec">{money(v)}</span></li>
            ))}
          </ul>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Date</th><th>Category</th><th>Note</th><th className="num">Amount</th></tr></thead>
              <tbody>{rows.map((r) => <tr key={r.id}><td>{day(r.date)}</td><td>{CATS[r.category]}</td><td>{r.note ?? ""}</td><td className="num rec">{money(r.amount)}</td></tr>)}</tbody>
              <tfoot><tr><th scope="row" colSpan={3}>Total</th><td className="num rec">{money(total)}</td></tr></tfoot>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
