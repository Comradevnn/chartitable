import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { addExpense, canRemoveExpense, describeError, getExpenses, removeExpense, restoreExpense, useCapabilities, useDataMode, writeBlockedReason } from "./data";
import type { DashExpense, ExpenseCategory } from "./types";
import { money, day, dayYear, localDate } from "./format";
import { Busy, Empty, Skel } from "./components";
import { RECEIPT_ACCEPT, canPreview, checkReceipt } from "./receipt";

const CATS: Record<ExpenseCategory, string> = { food: "Food purchases", transport: "Transport/fuel", facility: "Facility", supplies: "Supplies", staff: "Staff/stipends", other: "Other" };

export function Expenses() {
  const [rows, setRows] = useState<DashExpense[] | null>(null);
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<ExpenseCategory>("food");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(localDate());
  const [err, setErr] = useState<{ field: "amount" | "date"; msg: string } | null>(null);
  const [done, setDone] = useState("");
  const [undo, setUndo] = useState<DashExpense | null>(null);
  const [busy, setBusy] = useState(false);
  const [saveErr, setSaveErr] = useState("");
  const [receipt, setReceipt] = useState<File | null>(null);
  const [receiptErr, setReceiptErr] = useState("");
  const [thumb, setThumb] = useState("");
  const [removing, setRemoving] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const undoLink = useRef<HTMLButtonElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const nextFocus = useRef<"undo" | { row: string } | null>(null); // where focus goes once the list below has re-rendered
  useDataMode(); useCapabilities(); // re-render when the data mode or backend features change
  const removable = canRemoveExpense(); // hidden (not dead) when the backend has no remove/restore or sample data stands in for live
  const blocked = writeBlockedReason(); // fallback mode: every write is off, with this reason shown
  useEffect(() => { getExpenses().then(setRows); }, []);
  // The button that was clicked (Remove, Undo) is gone after the list updates: put focus somewhere stable instead of <body>.
  useEffect(() => {
    const want = nextFocus.current;
    if (!want) return;
    nextFocus.current = null;
    if (want === "undo") undoLink.current?.focus();
    else (document.getElementById("rm-" + want.row) ?? heading.current)?.focus();
  }, [rows, undo]);
  // Preview thumbnail for the chosen photo (HEIC usually can't be previewed: the file name is shown instead).
  useEffect(() => {
    if (!receipt || !canPreview(receipt)) { setThumb(""); return; }
    const url = URL.createObjectURL(receipt);
    setThumb(url);
    return () => URL.revokeObjectURL(url);
  }, [receipt]);
  function pickReceipt(f: File | undefined) {
    setDone("");
    if (!f) return;
    const problem = checkReceipt(f);
    if (problem) { setReceipt(null); setReceiptErr(problem); if (fileInput.current) fileInput.current.value = ""; return; }
    setReceiptErr(""); setReceipt(f);
  }
  function dropReceipt() {
    setReceipt(null); setReceiptErr("");
    if (fileInput.current) { fileInput.current.value = ""; fileInput.current.focus(); }
  }

  const totals = useMemo(() => {
    const t = new Map<ExpenseCategory, number>();
    (rows ?? []).forEach((r) => t.set(r.category, (t.get(r.category) ?? 0) + r.amount));
    return [...t.entries()].sort((a, b) => b[1] - a[1]);
  }, [rows]);
  const total = (rows ?? []).reduce((s, r) => s + r.amount, 0);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy || blocked) return;
    // Accept what people actually type: "$1,200", "24.5", "40 ".
    const clean = amount.replace(/[$,\s]/g, "");
    if (!/^\d+(\.\d{1,2})?$/.test(clean)) { setErr({ field: "amount", msg: clean === "" ? "Enter an amount, like 24.50." : "Use numbers only, like 24.50 (no words, at most two decimals)." }); return; }
    const cents = Math.round(parseFloat(clean) * 100);
    if (cents < 1) { setErr({ field: "amount", msg: "Amount must be at least $0.01." }); return; }
    if (date > localDate()) { setErr({ field: "date", msg: "That date is in the future. Pick today or earlier." }); return; }
    setErr(null);
    setSaveErr("");
    setDone("");
    setBusy(true);
    try {
      await addExpense({ date: new Date(date + "T12:00:00").getTime(), amount: cents, category, note: note.trim() || undefined }, receipt);
    } catch (e) {
      // Keep everything the person typed so they can fix or retry.
      setSaveErr("Couldn't save this expense. " + describeError(e) + " Your entries are still here.");
      setBusy(false);
      return;
    }
    setAmount(""); setNote(""); setReceipt(null); setReceiptErr("");
    if (fileInput.current) fileInput.current.value = "";
    setDone(`Added ${money(cents)} for ${CATS[category]}.`);
    setUndo(null); // only once the new expense is saved, so a typo or failed save keeps the Undo link
    setRows(await getExpenses());
    setBusy(false);
  }
  async function remove(r: DashExpense) {
    if (removing) return;
    setRemoving(r.id);
    let row: DashExpense | null;
    try { row = await removeExpense(r.id); } catch (e) { setSaveErr("Couldn't remove that expense. " + describeError(e)); setRemoving(null); return; }
    setRemoving(null);
    if (!row) { setSaveErr("Couldn't remove that expense. It may already be gone. The list is refreshed."); setRows(await getExpenses()); return; }
    setSaveErr("");
    nextFocus.current = "undo";
    setRows(await getExpenses());
    setDone("");
    setUndo(row);
  }
  async function undoRemove() {
    if (!undo) return;
    try { await restoreExpense(undo); } catch (e) { setSaveErr("Couldn't undo that removal. " + describeError(e)); return; }
    setSaveErr("");
    nextFocus.current = { row: undo.id };
    setRows(await getExpenses());
    setDone(`Restored ${money(undo.amount)} for ${CATS[undo.category]}.`);
    setUndo(null);
  }

  return (
    <section aria-labelledby="h-exp">
      <h2 id="h-exp" ref={heading} tabIndex={-1}>Expenses {rows && rows.length > 0 && <span className="period">All logged expenses, {dayYear(Math.min(...rows.map((r) => r.date)))} to {dayYear(Math.max(...rows.map((r) => r.date)))}</span>}</h2>
      <form className="addform" onSubmit={submit} noValidate>
        <label>Date<input type="date" value={date} onChange={(e) => { setDate(e.target.value); setDone(""); }} required aria-invalid={err?.field === "date"} aria-describedby={err?.field === "date" ? "exp-err" : undefined} />{err?.field === "date" && <span className="field-err" id="exp-err" role="alert">{err.msg}</span>}</label>
        <label>Amount ($)<input inputMode="decimal" value={amount} onChange={(e) => { setAmount(e.target.value); setDone(""); }} placeholder="0.00" aria-invalid={err?.field === "amount"} aria-describedby={err?.field === "amount" ? "exp-err" : undefined} />{err?.field === "amount" && <span className="field-err" id="exp-err" role="alert">{err.msg}</span>}</label>
        <label>Category<select value={category} onChange={(e) => setCategory(e.target.value as ExpenseCategory)}>{Object.entries(CATS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <label className="grow">Note<input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" /></label>
        <div className="receipt-field">
          <label htmlFor="exp-receipt">Receipt photo (optional)</label>
          <input id="exp-receipt" ref={fileInput} type="file" accept={RECEIPT_ACCEPT} onChange={(e) => pickReceipt(e.target.files?.[0])} aria-invalid={receiptErr !== ""} aria-describedby={"exp-receipt-help" + (receiptErr ? " exp-receipt-err" : "")} />
          <span id="exp-receipt-help" className="muted receipt-help">JPEG, PNG, WebP or HEIC, up to 5 MB.</span>
          {receiptErr && <span className="field-err" id="exp-receipt-err" role="alert">{receiptErr}</span>}
          {receipt && (
            <div className="receipt-chosen">
              {thumb ? <img src={thumb} alt="Preview of the chosen receipt photo" /> : null}
              <span className="receipt-name">{receipt.name}{thumb ? "" : " (no preview for this file type)"}</span>
              <button type="button" className="mini" onClick={dropReceipt}>Remove photo</button>
            </div>
          )}
        </div>
        <button className="primary" type="submit" disabled={busy || !!blocked} aria-describedby={blocked ? "exp-blocked" : undefined}>{busy ? "Saving…" : "Add expense"}</button>
        {blocked && <p className="muted blocked-why" id="exp-blocked">{blocked}</p>}
        {saveErr && <p className="err" role="alert">{saveErr}</p>}
        <p className="ok" role="status">{done}</p>
        {undo && <p className="ok" role="status">Removed {money(undo.amount)} for {CATS[undo.category]}. <button type="button" className="link" ref={undoLink} onClick={undoRemove}>Undo</button></p>}
      </form>

      {!rows ? (
        <Busy label="Loading expenses…">
          <div className="skel-col exp-skel">
            <Skel w="40%" /><Skel h="14px" /><Skel h="14px" /><Skel h="14px" />
            <div className="table-wrap skel-table">
              {[0, 1, 2, 3].map((i) => <div className="skel-row" key={i}><Skel w="15%" h="1.1rem" /><Skel w="25%" h="1.1rem" /><Skel w="12%" h="1.1rem" /></div>)}
            </div>
          </div>
        </Busy>
      ) : rows.length === 0 ? <Empty title="No expenses yet">Add the first one above. Cost per meal on the overview needs them.</Empty> : (
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
              <caption className="tbl-cap"><span className="tag tag-rec">Record</span> Expense ledger, newest first.</caption>
              <thead><tr><th scope="col">Date</th><th scope="col">Category</th><th scope="col" className="hide-sm">Note</th><th scope="col" className="num">Amount</th>{removable && <th scope="col"><span className="sr-only">Remove</span></th>}</tr></thead>
              <tbody>{rows.map((r) => <tr key={r.id}><td>{day(r.date)}</td><td>{CATS[r.category]}{r.receiptPhotoUrl && /^(https?:|blob:)/.test(r.receiptPhotoUrl) ? <a className="receipt-link" href={r.receiptPhotoUrl} target="_blank" rel="noopener noreferrer" aria-label={"Receipt for " + money(r.amount) + " " + CATS[r.category] + " expense from " + day(r.date) + " (opens in a new tab)"}>Receipt</a> : null}</td><td className="hide-sm">{r.note ?? ""}</td><td className="num rec">{money(r.amount)}</td>{removable && <td><button className="mini" id={"rm-" + r.id} disabled={removing !== null} onClick={() => remove(r)} aria-label={"Remove " + money(r.amount) + " " + CATS[r.category] + " expense from " + day(r.date)}>Remove</button></td>}</tr>)}</tbody>
              <tfoot><tr><th scope="row" colSpan={3} className="total-label">Total</th><td className="num rec">{money(total)}</td>{removable && <td></td>}</tr></tfoot>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
