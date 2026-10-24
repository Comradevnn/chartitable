import { useEffect, useRef, useState } from "react";
import { getDonorDetail, getDonors } from "./data";
import type { DashDonor, DonorDetail, DonorStatus } from "./types";
import { money, day, dayYear } from "./format";
import { Empty } from "./components";

const STATUS: Record<DonorStatus, string> = { new: "New", active: "Active", at_risk: "At risk", lapsed: "Lapsed" };
type Sort = "totalGiven" | "lastGiftAt";

export function Donors() {
  const [rows, setRows] = useState<DashDonor[] | null>(null);
  const [sort, setSort] = useState<Sort>("totalGiven");
  const [open, setOpen] = useState<string | null>(null);
  const detail = useRef<HTMLElement>(null);
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

  const sorted = [...rows].sort((a, b) => b[sort] - a[sort]);
  const sel = rows.find((d) => d.id === open);
  return (
    <section aria-labelledby="h-donors">
      <h2 id="h-donors">Donors</h2>
      <p className="lede">For thanking people, not ranking them. “Anonymous” donors asked not to be listed.</p>
      <div className="toolbar" role="group" aria-label="Sort donors">
        <button className={sort === "totalGiven" ? "chip on" : "chip"} aria-pressed={sort === "totalGiven"} onClick={() => setSort("totalGiven")}>Total given</button>
        <button className={sort === "lastGiftAt" ? "chip on" : "chip"} aria-pressed={sort === "lastGiftAt"} onClick={() => setSort("lastGiftAt")}>Most recent</button>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Donor</th><th className="num">Total given</th><th className="num">Gifts</th><th>Last gift</th><th>Status</th><th>Thanked</th></tr></thead>
          <tbody>
            {sorted.map((d) => (
              <tr key={d.id} className={open === d.id ? "sel" : ""}>
                <th scope="row"><button className="link" onClick={() => setOpen(open === d.id ? null : d.id)} aria-expanded={open === d.id}>{d.displayName}</button></th>
                <td className="num rec">{money(d.totalGiven)}</td>
                <td className="num">{d.giftCount}</td>
                <td>{day(d.lastGiftAt)}</td>
                <td><span className={"status s-" + d.status}>{STATUS[d.status]}</span></td>
                <td>{d.thankedAt ? "Yes, " + day(d.thankedAt) : <span className="todo">Not yet</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {sel && (
        <aside className="detail" ref={detail} tabIndex={-1} aria-label={"Details for " + sel.displayName}>
          <h3>{sel.displayName}</h3>
          <p><span className="rec">{sel.giftCount} {sel.giftCount === 1 ? "gift" : "gifts"}, {money(sel.totalGiven)} total</span>, first on {day(sel.firstGiftAt)}, latest on {day(sel.lastGiftAt)}.</p>
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
          <p className="muted">Status comes from the date of the last gift: new, active within 45 days, at risk 46 to 90, lapsed after 90.</p>
        </aside>
      )}
    </section>
  );
}
