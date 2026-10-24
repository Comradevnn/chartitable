import { useEffect, useMemo, useState, type FormEvent } from "react";
import { addExpense, getExpenses, removeExpense, restoreExpense } from "./data";
import type { DashExpense, ExpenseCategory } from "./types";
import { money, day, dayYear } from "./format";
import { Empty } from "./components";

const CATS: Record<ExpenseCategory, string> = { food: "Food purchases", transport: "Transport/fuel", facility: "Facility", supplies: "Supplies", staff: "Staff/stipends", other: "Other" };

export function Expenses() {
  const [rows, setRows] = useState<DashExpense[] | null>(null);
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<ExpenseCategory>("food");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [err, setErr] = useState<{ field: "amount" | "date"; msg: string } | null>(null);
  const [done, setDone] = useState("");
  const [undo, setUndo] = useState<DashExpense | null>(null);
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
    setUndo(null);
    // Accept what people actually type: "$1,200", "24.5", "40 ".
    const clean = amount.replace(/[$,\s]/g, "");
    if (!/^\d+(\.\d{1,2})?$/.test(clean)) { setErr({ field: "amount", msg: clean === "" ? "Enter an amount, like 24.50." : "Use numbers only, like 24.50 (no words, at most two decimals)." }); return; }
    const cents = Math.round(parseFloat(clean) * 100);
    if (cents < 1) { setErr({ field: "amount", msg: "Amount must be at least $0.01." }); return; }
    if (date > new Date().toISOString().slice(0, 10)) { setErr({ field: "date", msg: "That date is in the future. Pick today or earlier." }); return; }
    setErr(null);
    await addExpense({ date: new Date(date + "T12:00:00").getTime(), amount: cents, category, note: note.trim() || undefined });
    setRows(await getExpenses());
    setDone(`Added ${money(cents)} for ${CATS[category]}.`);
    setAmount(""); setNote("");
  }
  async function remove(r: DashExpense) {
    const row = await removeExpense(r.id);
    if (!row) return;
    setRows(await getExpenses());
    setDone("");
    setUndo(row);
  }
  async function undoRemove() {
    if (!undo) return;
    await restoreExpense(undo);
    setRows(await getExpenses());
    setDone(`Restored ${money(undo.amount)} for ${CATS[undo.category]}.`);
    setUndo(null);
  }

  return (
    <section aria-labelledby="h-exp">
      <h2 id="h-exp">Expenses {rows.length > 0 && <span className="period">All logged expenses, {dayYear(Math.min(...rows.map((r) => r.date)))} to {dayYear(Math.max(...rows.map((r) => r.date)))}</span>}</h2>
      <form className="addform" onSubmit={submit} noValidate>
        <label>Date<input type="date" value={date} onChange={(e) => { setDate(e.target.value); setDone(""); }} required aria-invalid={err?.field === "date"} aria-describedby={err?.field === "date" ? "exp-err" : undefined} />{err?.field === "date" && <span className="field-err" id="exp-err" role="alert">{err.msg}</span>}</label>
        <label>Amount ($)<input inputMode="decimal" value={amount} onChange={(e) => { setAmount(e.target.value); setDone(""); }} placeholder="0.00" aria-invalid={err?.field === "amount"} aria-describedby={err?.field === "amount" ? "exp-err" : undefined} />{err?.field === "amount" && <span className="field-err" id="exp-err" role="alert">{err.msg}</span>}</label>
        <label>Category<select value={category} onChange={(e) => setCategory(e.target.value as ExpenseCategory)}>{Object.entries(CATS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <label className="grow">Note<input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" /></label>
        <button className="primary" type="submit">Add expense</button>
        <p className="ok" role="status">{done}</p>
        {undo && <p className="ok" role="status">Removed {money(undo.amount)} for {CATS[undo.category]}. <button type="button" className="link" onClick={undoRemove}>Undo</button></p>}
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
              <caption className="sr-only">Expense ledger, newest first</caption>
              <thead><tr><th scope="col">Date</th><th scope="col">Category</th><th scope="col" className="hide-sm">Note</th><th scope="col" className="num">Amount</th><th scope="col"><span className="sr-only">Remove</span></th></tr></thead>
              <tbody>{rows.map((r) => <tr key={r.id}><td>{day(r.date)}</td><td>{CATS[r.category]}</td><td className="hide-sm">{r.note ?? ""}</td><td className="num rec">{money(r.amount)}</td><td><button className="mini" onClick={() => remove(r)} aria-label={"Remove " + money(r.amount) + " " + CATS[r.category] + " expense from " + day(r.date)}>Remove</button></td></tr>)}</tbody>
              <tfoot><tr><th scope="row" colSpan={3} className="total-label">Total</th><td className="num rec">{money(total)}</td><td></td></tr></tfoot>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
