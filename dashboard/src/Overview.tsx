import { useEffect, useState } from "react";
import { getDonors, getOverview } from "./data";
import type { DashDonor, DashOverview } from "./types";
import { money, day } from "./format";
import { Empty, Estimate, Record, Tile } from "./components";

export function Overview({ onSeeDonors }: { onSeeDonors: () => void }) {
  const [o, setO] = useState<DashOverview | null>(null);
  const [donors, setDonors] = useState<DashDonor[]>([]);
  useEffect(() => { getOverview().then(setO); getDonors().then(setDonors); }, []);
  if (!o) return <p className="loading">Loading…</p>;

  const diff = o.totalRaised - o.prevPeriodRaised;
  const c = o.donorCounts;
  const toThank = donors.filter((d) => d.thankedAt === null).length;
  const quiet = donors.filter((d) => d.status === "at_risk").length;
  return (
    <section aria-labelledby="h-overview">
      <h2 id="h-overview">Overview <span className="period">{o.period.label}</span></h2>
      {donors.length > 0 && (
        <div className="attention" role="region" aria-label="Needs attention">
          <p>
            {toThank === 0 ? "Everyone has been thanked." : <><strong>{toThank} {toThank === 1 ? "donor needs" : "donors need"} a thank-you</strong>{quiet > 0 && <>, and {quiet} {quiet === 1 ? "has" : "have"} been quiet lately</>}.</>}
          </p>
          <button className="primary" onClick={onSeeDonors}>See who</button>
        </div>
      )}
      <div className="tiles">
        <Tile label="Raised" tag="Record" note={o.prevPeriodRaised ? `${diff >= 0 ? "Up" : "Down"} ${money(Math.abs(diff))} from the 30 days before (${money(o.prevPeriodRaised)})` : undefined}>
          <Record>{money(o.totalRaised)}</Record>
        </Tile>
        <Tile label="Donors" tag="Record" note={`${c.new} new · ${c.returning} returning · ${c.lapsed} gave before`}>
          <Record>{c.total}</Record>
        </Tile>
        <Tile label="Meals served" tag="Record" note="Counted by pantry staff">
          <Record>{o.mealsServed}</Record>
        </Tile>
        <Tile label="Cost per meal" tag="Estimate" note={`Spent ${money(o.expensesTotal)} ÷ ${o.mealsServed} meals served`}>
          {o.costPerMeal.value === null
            ? <span className="muted">Not enough logged meals yet</span>
            : <Estimate formula={o.costPerMeal.formula}>about {money(o.costPerMeal.value)}</Estimate>}
        </Tile>
      </div>

      <h3>Latest staff updates</h3>
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
