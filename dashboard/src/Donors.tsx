import { useEffect, useRef, useState } from "react";
import { describeError, getDonorDetail, getDonors, markThanked, useDataMode } from "./data";
import type { DashDonor, DonorDetail, DonorStatus } from "./types";
import { money, day, dayYear, donorLabel, isAnonymous } from "./format";
import { Busy, Empty, Skel } from "./components";
import { askDonorView, peekDonorView } from "./donorIntent";

// Plain, non-judging labels for the people behind the numbers (dignity rule). Enum values stay as in the data contract.
const STATUS: Record<DonorStatus, string> = { new: "New", active: "Active", at_risk: "Quiet lately", lapsed: "Gave before" };
type Sort = "totalGiven" | "lastGiftAt";
type View = "all" | "needs";

// Case- and accent-insensitive: "jose" finds "José".
const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/** Same columns and row height as the loaded table, so the list lands without a jump. */
function DonorsSkeleton() {
  return (
    <section aria-labelledby="h-donors">
      <h2 id="h-donors">Donors</h2>
      <Busy label="Loading donors…">
        <div className="skel-col">
          <Skel w="min(26rem, 100%)" h="44px" />
          <Skel w="22rem" h="44px" />
          <div className="table-wrap skel-table">
            {[0, 1, 2, 3, 4].map((i) => <div className="skel-row" key={i}><Skel w="40%" h="1.1rem" /><Skel w="12%" h="1.1rem" /><Skel w="18%" h="1.1rem" /></div>)}
          </div>
        </div>
      </Busy>
    </section>
  );
}

export function Donors() {
  const mode = useDataMode();
  const live = mode === "live";
  const [thanking, setThanking] = useState<string | null>(null);
  const [thankErr, setThankErr] = useState<{ id: string; msg: string } | null>(null);
  const [rows, setRows] = useState<DashDonor[] | null>(null);
  const [sort, setSort] = useState<Sort>("totalGiven");
  // Arriving from the Overview's "See who needs a thank-you" starts on that filter.
  const [view, setView] = useState<View>(() => peekDonorView() ?? "all");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [said, setSaid] = useState("");
  const detail = useRef<HTMLElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const search = useRef<HTMLInputElement>(null);
  useEffect(() => { askDonorView(null); }, []);
  useEffect(() => { getDonors().then(setRows); }, []);
  const [info, setInfo] = useState<DonorDetail | null>(null);
  useEffect(() => {
    if (!open) { setInfo(null); return; }
    detail.current?.focus();
    let live = true;
    getDonorDetail(open).then((d) => { if (live) setInfo(d); });
    return () => { live = false; };
  }, [open]);
  if (!rows) return <DonorsSkeleton />;
  if (rows.length === 0) return (
    <section aria-labelledby="h-donors">
      <h2 id="h-donors">Donors</h2>
      <Empty title="No donors yet">Gifts made through the donate page appear here with a thank-you flag.</Empty>
    </section>
  );

  const needs = rows.filter((d) => d.thankedAt === null);
  // Donors who asked not to be listed never show a name (donorLabel); two of them stay distinguishable by first-gift date only.
  const label = donorLabel;
  // Donor records carry no email, so name is the only searchable field. Anonymous donors match "anonymous".
  const needle = fold(q.trim());
  const shown = (view === "needs" ? needs : rows)
    .filter((d) => !needle || fold(label(d)).includes(needle))
    .sort((a, b) => b[sort] - a[sort]);
  const sel = rows.find((d) => d.id === open);
  const searching = needle !== "";

  function clearSearch() {
    setQ("");
    search.current?.focus();
  }
  function resetAll() {
    setQ("");
    setView("all");
    search.current?.focus();
  }

  function close() {
    setOpen(null);
    opener.current?.focus();
  }
  async function thank(d: DashDonor) {
    if (thanking) return;
    setThanking(d.id);
    setThankErr(null);
    setSaid("");
    try {
      setRows(await markThanked(d.id));
      setSaid(`Marked ${isAnonymous(d) ? "the anonymous donor" : d.displayName} as thanked.`);
    } catch (e) {
      setThankErr({ id: d.id, msg: "Couldn't mark as thanked. " + describeError(e) });
    } finally {
      setThanking(null);
    }
  }

  return (
    <section aria-labelledby="h-donors" onKeyDown={(e) => { if (e.key === "Escape" && open) close(); }}>
      <h2 id="h-donors">Donors</h2>
      <p className="lede">For thanking people, not ranking them. “Anonymous” donors asked not to be listed.</p>
      <div className="search" role="search">
        <label htmlFor="donor-search" className="sr-only">Search donors by name</label>
        <svg className="search-icon" viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" focusable="false"><circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.8" /><path d="M13 13l4.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
        <input
          id="donor-search" ref={search} type="search" autoComplete="off" spellCheck={false}
          placeholder="Search donors by name" value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Escape" && q) { e.preventDefault(); e.stopPropagation(); setQ(""); } }}
        />
        {q && (
          <button type="button" className="search-clear" aria-label="Clear search" onClick={clearSearch}>
            <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true" focusable="false"><path d="M5 5l10 10M15 5L5 15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          </button>
        )}
      </div>
      <div className="toolbar" role="group" aria-label="Show and sort donors">
        <button className={view === "needs" ? "chip on" : "chip"} aria-pressed={view === "needs"} onClick={() => setView(view === "needs" ? "all" : "needs")}>Needs a thank-you ({needs.length})</button>
        <button className={sort === "totalGiven" ? "chip on" : "chip"} aria-pressed={sort === "totalGiven"} onClick={() => setSort("totalGiven")}>Total given</button>
        <button className={sort === "lastGiftAt" ? "chip on" : "chip"} aria-pressed={sort === "lastGiftAt"} onClick={() => setSort("lastGiftAt")}>Most recent</button>
      </div>
      <p className="count muted" role="status" aria-live="polite">Showing {shown.length} of {rows.length} {rows.length === 1 ? "donor" : "donors"}</p>
      <p className="ok" role="status">{said}</p>
      {shown.length === 0 ? (
        searching ? (
          <div className="empty">
            <h3>No donors match “{q.trim()}”</h3>
            <p>{view === "needs" ? "Only donors who still need a thank-you are searched right now. Check the spelling, or search everyone." : "Check the spelling, or try just part of the name."}</p>
            <div className="empty-actions">
              <button className="mini" onClick={clearSearch}>Clear search</button>
              {view === "needs" && <button className="mini" onClick={resetAll}>Show all donors</button>}
            </div>
          </div>
        ) : (
          <Empty title="Everyone has been thanked">Nice work. New gifts will show up here until they are marked thanked.</Empty>
        )
      ) : (
        <div className="table-wrap">
          <table>
            <caption className="tbl-cap"><span className="tag tag-rec">Record</span> Gifts and dates are recorded. Status is worked out from the last gift date.</caption>
            <thead><tr><th scope="col">Donor</th><th scope="col" className="num">Total given</th><th scope="col" className="num hide-sm">Gifts</th><th scope="col" className="hide-sm">Last gift</th><th scope="col">Status</th><th scope="col">Thanked</th></tr></thead>
            <tbody>
              {shown.map((d) => (
                <tr key={d.id} className={open === d.id ? "sel" : ""}>
                  <th scope="row"><button className="link" onClick={(e) => { opener.current = e.currentTarget; setOpen(open === d.id ? null : d.id); }} aria-expanded={open === d.id}>{label(d)}</button></th>
                  <td className="num rec">{money(d.totalGiven)}</td>
                  <td className="num hide-sm">{d.giftCount}</td>
                  <td className="hide-sm">{day(d.lastGiftAt)}</td>
                  <td><span className={"status s-" + d.status}>{STATUS[d.status]}</span></td>
                  <td>
                    {d.thankedAt ? "Yes, " + day(d.thankedAt) : <button className="mini" disabled={thanking !== null} onClick={() => thank(d)} aria-label={"Mark " + label(d) + " as thanked"}>{thanking === d.id ? "Saving…" : "Mark thanked"}</button>}
                    {thankErr?.id === d.id && <span className="field-err row-err" role="alert">{thankErr.msg}</span>}
                  </td>
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
          <dl className="facts-list">
            <div><dt>Total given <span className="tag tag-rec">Record</span></dt><dd className="rec">{money(sel.totalGiven)}</dd></div>
            <div><dt>Gifts <span className="tag tag-rec">Record</span></dt><dd className="rec">{sel.giftCount}</dd></div>
            <div><dt>First gift</dt><dd>{dayYear(sel.firstGiftAt)}</dd></div>
            <div><dt>Latest gift</dt><dd>{dayYear(sel.lastGiftAt)}</dd></div>
            <div><dt>Status</dt><dd><span className={"status s-" + sel.status}>{STATUS[sel.status]}</span></dd></div>
            <div><dt>Thanked</dt><dd>{sel.thankedAt ? "Yes, " + dayYear(sel.thankedAt) : "Not yet"}</dd></div>
          </dl>
          {live && <p className="muted gift-note">Gift history isn't available yet.</p>}
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
