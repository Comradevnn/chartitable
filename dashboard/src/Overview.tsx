import { useEffect, useState, type ReactNode } from "react";
import { getDonors, getOverview } from "./data";
import type { DashDonor, DashOverview } from "./types";
import { money, day, donorLabel } from "./format";
import { Busy, Empty, Estimate, Record, Skel } from "./components";
import { askDonorView } from "./donorIntent";

const PREVIEW = 3;

/** Same shape as the loaded Overview (lead, facts, updates) so nothing jumps when data arrives. */
function OverviewSkeleton() {
  return (
    <section aria-labelledby="h-overview">
      <h2 id="h-overview">Overview</h2>
      <Busy label="Loading overview…">
        <div className="lead">
          <div className="lead-main skel-col">
            <Skel w="70%" h="3.2rem" />
            <Skel w="45%" />
            <Skel h="2.6rem" /><Skel h="2.6rem" /><Skel h="2.6rem" />
          </div>
          <div className="lead-side skel-col">
            <Skel w="55%" h="2.6rem" /><Skel w="40%" />
            <Skel w="45%" h="2.6rem" /><Skel w="40%" />
          </div>
        </div>
        <div className="facts">
          <div className="skel-col"><Skel w="30%" /><Skel w="25%" h="1.6rem" /><Skel w="60%" /></div>
          <div className="skel-col"><Skel w="30%" /><Skel w="25%" h="1.6rem" /><Skel w="60%" /></div>
        </div>
        <div className="skel-col updates-skel"><Skel w="35%" /><Skel h="3rem" /><Skel h="3rem" /><Skel h="3rem" /></div>
      </Busy>
    </section>
  );
}

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
  if (!o) return <OverviewSkeleton />;

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
            <Busy label="Loading donors…"><Skel w="70%" h="3.2rem" /><Skel w="45%" /><Skel h="2.6rem" /><Skel h="2.6rem" /></Busy>
          ) : donors.length === 0 ? (
            <>
              <h3 className="lead-title">No donors yet</h3>
              <p className="lead-sub">Gifts made through the donate page will show up here, with a flag for who still needs a thank-you.</p>
            </>
          ) : waiting.length === 0 ? (
            <h3 className="lead-title">Everyone has been thanked.</h3>
          ) : (
            <>
              <h3 className="lead-title"><span className="lead-n">{waiting.length}</span> {waiting.length === 1 ? "donor needs" : "donors need"} a thank-you</h3>
              {quiet > 0 && <p className="lead-sub">{quiet} {quiet === 1 ? "has" : "have"} also been quiet lately.</p>}
              <ul className="waiting">
                {waiting.slice(0, PREVIEW).map((d) => (
                  <li key={d.id}>
                    <span className="waiting-name">{donorLabel(d)}</span>
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
          <Fact size="major" label="Raised" tag="Record" note={o.prevPeriodRaised ? `${diff >= 0 ? "Up" : "Down"} ${money(Math.abs(diff))} from the 30 days before (that period was ${money(o.prevPeriodRaised)}, also a record)` : "No gifts recorded in the 30 days before"}>
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
