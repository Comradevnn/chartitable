import { useEffect, useRef, useState } from "react";
import { getDonorDetail, getDonors, markThanked } from "./data";
import type { DashDonor, DonorDetail, DonorStatus } from "./types";
import { money, day, dayYear } from "./format";
import { Empty } from "./components";

// Plain, non-judging labels for the people behind the numbers (dignity rule). Enum values stay as in the data contract.
const STATUS: Record<DonorStatus, string> = { new: "New", active: "Active", at_risk: "Quiet lately", lapsed: "Gave before" };
type Sort = "totalGiven" | "lastGiftAt";
type View = "all" | "needs";

export function Donors() {
  const [rows, setRows] = useState<DashDonor[] | null>(null);
  const [sort, setSort] = useState<Sort>("totalGiven");
  const [view, setView] = useState<View>("all");
  const [open, setOpen] = useState<string | null>(null);
  const [said, setSaid] = useState("");
  const detail = useRef<HTMLElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  useEffect(() => { getDonors().then(setRows); }, []);
  const [info, setInfo] = useState<DonorDetail | null>(null);
  useEffect(() => {
    if (!open) { setInfo(null); return; }
    detail.current?.focus();
    let live = true;
    getDonorDetail(open).then((d) => { if (live) setInfo(d); });
    return () => { live = false; };
  }, [open]);
  if (!rows) return <p className="loading">Loading…</p>;
  if (rows.length === 0) return <Empty title="No donors yet">Gifts made through the donate page appear here with a thank-you flag.</Empty>;

  const needs = rows.filter((d) => d.thankedAt === null);
  const shown = (view === "needs" ? needs : rows).slice().sort((a, b) => b[sort] - a[sort]);
  const sel = rows.find((d) => d.id === open);
  // Two anonymous donors must stay distinguishable without revealing anything about them.
  const label = (d: DashDonor) => (d.displayName === "Anonymous" ? "Anonymous donor, first gave " + day(d.firstGiftAt) : d.displayName);

  function close() {
    setOpen(null);
    opener.current?.focus();
  }
  async function thank(d: DashDonor) {
    setRows(await markThanked(d.id));
    setSaid(`Marked ${d.displayName === "Anonymous" ? "the anonymous donor" : d.displayName} as thanked.`);
  }

  return (
    <section aria-labelledby="h-donors" onKeyDown={(e) => { if (e.key === "Escape" && open) close(); }}>
      <h2 id="h-donors">Donors</h2>
      <p className="lede">For thanking people, not ranking them. “Anonymous” donors asked not to be listed.</p>
      <div className="toolbar" role="group" aria-label="Show and sort donors">
        <button className={view === "needs" ? "chip on" : "chip"} aria-pressed={view === "needs"} onClick={() => setView(view === "needs" ? "all" : "needs")}>Needs a thank-you ({needs.length})</button>
        <button className={sort === "totalGiven" ? "chip on" : "chip"} aria-pressed={sort === "totalGiven"} onClick={() => setSort("totalGiven")}>Total given</button>
        <button className={sort === "lastGiftAt" ? "chip on" : "chip"} aria-pressed={sort === "lastGiftAt"} onClick={() => setSort("lastGiftAt")}>Most recent</button>
      </div>
      <p className="ok" role="status">{said}</p>
      {shown.length === 0 ? (
        <Empty title="Everyone has been thanked">Nice work. New gifts will show up here until they are marked thanked.</Empty>
      ) : (
        <div className="table-wrap">
          <table>
            <thead><tr><th scope="col">Donor</th><th scope="col" className="num">Total given</th><th scope="col" className="num hide-sm">Gifts</th><th scope="col" className="hide-sm">Last gift</th><th scope="col">Status</th><th scope="col">Thanked</th></tr></thead>
            <tbody>
              {shown.map((d) => (
                <tr key={d.id} className={open === d.id ? "sel" : ""}>
                  <th scope="row"><button className="link" onClick={(e) => { opener.current = e.currentTarget; setOpen(open === d.id ? null : d.id); }} aria-expanded={open === d.id}>{label(d)}</button></th>
                  <td className="num rec">{money(d.totalGiven)}</td>
                  <td className="num hide-sm">{d.giftCount}</td>
                  <td className="hide-sm">{day(d.lastGiftAt)}</td>
                  <td><span className={"status s-" + d.status}>{STATUS[d.status]}</span></td>
                  <td>{d.thankedAt ? "Yes, " + day(d.thankedAt) : <button className="mini" onClick={() => thank(d)} aria-label={"Mark " + label(d) + " as thanked"}>Mark thanked</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {sel && (
        <aside className="detail" ref={detail} tabIndex={-1} aria-label={"Details for " + label(sel)}>
          <div className="detail-head">
            <h3>{label(sel)}</h3>
            <button className="chip" onClick={close}>Close</button>
          </div>
          <p>
            <span className="rec">{sel.giftCount} {sel.giftCount === 1 ? "gift" : "gifts"}, {money(sel.totalGiven)} total</span>
            {sel.giftCount === 1 ? ` on ${day(sel.firstGiftAt)}.` : `, first on ${day(sel.firstGiftAt)}, latest on ${day(sel.lastGiftAt)}.`}
          </p>
          {info && (
            <>
              <h4>Gift history</h4>
              <ul className="gifts">
                {info.gifts.map((g, i) => <li key={i}><span className="rec">{money(g.amountCents)}</span> <time>{dayYear(g.at)}</time> <span className="muted">{g.label}</span></li>)}
              </ul>
              <h4>What this donor sees on the charity's site</h4>
              <div className="preview">
                <p className="p-story">{info.preview.story}</p>
                <ul className="p-facts">
                  {info.preview.records.map((r, i) => <li key={i} className="p-rec">{r.text} · {r.dateLabel}</li>)}
                  {info.preview.estimates.map((e, i) => <li key={i} className="p-est">{e.text}</li>)}
                </ul>
              </div>
            </>
          )}
          <p className="muted">Status comes from the date of the last gift: New (first gift this period), Active (within 45 days), Quiet lately (46 to 90 days), Gave before (over 90 days).</p>
        </aside>
      )}
    </section>
  );
}
