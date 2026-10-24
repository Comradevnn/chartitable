import { useEffect, useState } from "react";
import { getOverview } from "./data";
import type { DashOverview } from "./types";
import { money, day } from "./format";
import { Empty, Estimate, Record, Tile } from "./components";

export function Overview() {
  const [o, setO] = useState<DashOverview | null>(null);
  useEffect(() => { getOverview().then(setO); }, []);
  if (!o) return <p className="loading">Loading…</p>;

  const diff = o.totalRaised - o.prevPeriodRaised;
  const c = o.donorCounts;
  return (
    <section aria-labelledby="h-overview">
      <h2 id="h-overview">Overview <span className="period">{o.period.label}</span></h2>
      <div className="tiles">
        <Tile label="Raised" tag="Record" note={o.prevPeriodRaised ? `${diff >= 0 ? "Up" : "Down"} ${money(Math.abs(diff))} from the 30 days before (${money(o.prevPeriodRaised)})` : undefined}>
          <Record>{money(o.totalRaised)}</Record>
        </Tile>
        <Tile label="Donors" tag="Record" note={`${c.new} new · ${c.returning} returning · ${c.lapsed} lapsed`}>
          <Record>{c.total}</Record>
        </Tile>
        <Tile label="Meals served" tag="Record" note="Counted by pantry staff">
          <Record>{o.mealsServed}</Record>
        </Tile>
        <Tile label="Cost per meal" tag="Estimate" note={`Spent ${money(o.expensesTotal)} in the period`}>
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
