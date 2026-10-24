import { useEffect, useState, type ReactNode } from "react";
import { getDonors, getOverview } from "./data";
import type { DashDonor, DashOverview } from "./types";
import { money, day } from "./format";
import { Empty, Estimate, Record } from "./components";
import { askDonorView } from "./donorIntent";

const PREVIEW = 3;

// Two anonymous donors must stay distinguishable without revealing anything about them.
const nameOf = (d: DashDonor) => (d.displayName === "Anonymous" ? "Anonymous donor, first gave " + day(d.firstGiftAt) : d.displayName);

/** One labelled number. `size` sets its rank on the page: the record/estimate tag always travels with the figure. */
function Fact({ label, tag, note, size, children }: { label: string; tag: "Record" | "Estimate"; note?: ReactNode; size: "major" | "minor"; children: ReactNode }) {
  return (
    <div className={"fact fact-" + size}>
      <p className="fact-label">{label} <span className={"tag " + (tag === "Record" ? "tag-rec" : "tag-est")}>{tag}</span></p>
      <p className="fact-value">{children}</p>
      {note && <p className="fact-note">{note}</p>}
    </div>
  );
}

export function Overview({ onSeeDonors }: { onSeeDonors: () => void }) {
  const [o, setO] = useState<DashOverview | null>(null);
  const [donors, setDonors] = useState<DashDonor[] | null>(null);
  useEffect(() => { getOverview().then(setO); getDonors().then(setDonors); }, []);
  if (!o) return <p className="loading">Loading…</p>;

  const diff = o.totalRaised - o.prevPeriodRaised;
  const c = o.donorCounts;
  const waiting = (donors ?? []).filter((d) => d.thankedAt === null).sort((a, b) => b.lastGiftAt - a.lastGiftAt);
  const quiet = (donors ?? []).filter((d) => d.status === "at_risk").length;
  const seeWho = () => { askDonorView("needs"); onSeeDonors(); };

  return (
    <section aria-labelledby="h-overview">
      <h2 id="h-overview">Overview <span className="period">{o.period.label}</span></h2>

      <div className="lead">
        <div className="lead-main" role="region" aria-label="Needs attention">
          {donors === null ? (
            <p className="muted">Loading donors…</p>
          ) : donors.length === 0 ? (
            <h3 className="lead-title">No donors yet</h3>
          ) : waiting.length === 0 ? (
            <h3 className="lead-title">Everyone has been thanked.</h3>
          ) : (
            <>
              <h3 className="lead-title"><span className="lead-n">{waiting.length}</span> {waiting.length === 1 ? "donor needs" : "donors need"} a thank-you</h3>
              {quiet > 0 && <p className="lead-sub">{quiet} {quiet === 1 ? "has" : "have"} also been quiet lately.</p>}
              <ul className="waiting">
                {waiting.slice(0, PREVIEW).map((d) => (
                  <li key={d.id}>
                    <span className="waiting-name">{nameOf(d)}</span>
                    <span className="waiting-gift"><Record>{money(d.totalGiven)}</Record> · last gift {day(d.lastGiftAt)}</span>
                  </li>
                ))}
              </ul>
              {waiting.length > PREVIEW && <p className="muted waiting-more">and {waiting.length - PREVIEW} more</p>}
              <button className="primary" onClick={seeWho}>See who needs a thank-you</button>
            </>
          )}
        </div>

        <div className="lead-side">
          <Fact size="major" label="Raised" tag="Record" note={o.prevPeriodRaised ? `${diff >= 0 ? "Up" : "Down"} ${money(Math.abs(diff))} from the 30 days before (${money(o.prevPeriodRaised)})` : undefined}>
            <Record>{money(o.totalRaised)}</Record>
          </Fact>
          <Fact size="major" label="Meals served" tag="Record" note="Counted by pantry staff">
            <Record>{o.mealsServed}</Record>
          </Fact>
        </div>
      </div>

      <div className="facts">
        <Fact size="minor" label="Donors" tag="Record" note={`${c.new} new · ${c.returning} returning · ${c.lapsed} gave before`}>
          <Record>{c.total}</Record>
        </Fact>
        <Fact size="minor" label="Cost per meal" tag="Estimate" note={`Spent ${money(o.expensesTotal)} ÷ ${o.mealsServed} meals served`}>
          {o.costPerMeal.value === null
            ? <span className="muted">Not enough logged meals yet</span>
            : <Estimate formula={o.costPerMeal.formula}>about {money(o.costPerMeal.value)}</Estimate>}
        </Fact>
      </div>

      <h3 className="updates-title">Latest staff updates</h3>
      {o.recentUpdates.length === 0 ? (
        <Empty title="No updates logged yet">When staff log meals or produce, they show up here. Cost per meal stays blank until then.</Empty>
      ) : (
        <ul className="updates">
          {o.recentUpdates.map((u) => (
            <li key={u.id}>
              <Record>{u.count} {u.unit}</Record> <time>{day(u.loggedAt)}</time>
              {u.note && <span className="note">“{u.note}”</span>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
