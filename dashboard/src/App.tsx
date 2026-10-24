import { useEffect, useRef, useState, type FormEvent } from "react";
import { liveConfigured, loggedIn, login, logout, useDataMode } from "./data";
import { charityName } from "./mock/data";
import { Overview } from "./Overview";
import { Donors } from "./Donors";
import { Expenses } from "./Expenses";

type Tab = "overview" | "donors" | "expenses";
const TABS: [Tab, string][] = [["overview", "Overview"], ["donors", "Donors"], ["expenses", "Expenses"]];

const ERRORS = {
  empty: "Enter the PIN to continue.",
  wrong: "That PIN didn't work. Try again.",
  locked: "Too many wrong tries. Wait a few minutes, then try again.",
} as const;

function Gate({ onIn }: { onIn: () => void }) {
  const [pin, setPin] = useState("");
  const [err, setErr] = useState<keyof typeof ERRORS | null>(null);
  const [busy, setBusy] = useState(false);
  async function go(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    const res = await login(pin);
    setBusy(false);
    if (res.ok) onIn(); else setErr(res.reason);
  }
  return (
    <main className="gate">
      <form onSubmit={go}>
        <h1>{charityName}</h1>
        <p>{liveConfigured ? "Staff sign-in. Enter the pantry's staff PIN." : "Demo data: any PIN works."}</p>
        <label>Staff PIN<input type="password" inputMode="numeric" autoComplete="off" value={pin} onChange={(e) => { setPin(e.target.value); setErr(null); }} aria-invalid={err !== null} aria-describedby={err ? "pin-err" : undefined} /></label>
        {err && <p className="err" id="pin-err" role="alert">{ERRORS[err]}</p>}
        <button className="primary" type="submit" disabled={busy}>{busy ? "Checking…" : "Open dashboard"}</button>
      </form>
    </main>
  );
}

/** Always-visible data source. Text carries the meaning (the dot is decoration). A failed live load is explained in words. */
function ModeBadge() {
  const mode = useDataMode();
  return (
    <p className={"mode mode-" + mode} role="status">
      <span className="mode-dot" aria-hidden="true" />
      <span className="mode-name">{mode === "live" ? "Live data · Convex" : "Demo data"}</span>
      {mode === "fallback" && <span className="mode-why">Live data couldn't load, showing sample data.</span>}
    </p>
  );
}

export function App() {
  const [ok, setOk] = useState(loggedIn());
  const [tab, setTab] = useState<Tab>("overview");
  const mode = useDataMode();
  const main = useRef<HTMLElement>(null);
  // After sign-in, land focus on the content. Tab changes leave focus on the nav button so keyboard users keep their place.
  useEffect(() => { if (ok) main.current?.focus(); }, [ok]);
  if (!ok) return <Gate onIn={() => setOk(true)} />;
  // `key={mode}`: if live data stops loading mid-session, each screen remounts and re-reads, so nothing mixes live and sample numbers.
  return (
    <>
      <header className="top">
        <h1 className="brand">{charityName}</h1>
        <nav aria-label="Dashboard sections">
          {TABS.map(([k, v]) => <button key={k} className={tab === k ? "navbtn on" : "navbtn"} aria-current={tab === k ? "page" : undefined} onClick={() => setTab(k)}>{v}</button>)}
        </nav>
        <ModeBadge />
        <button className="link" onClick={() => { logout(); setOk(false); }}>Sign out</button>
      </header>
      <main className="page" ref={main} tabIndex={-1} aria-label={TABS.find(([k]) => k === tab)![1]}>
        <p className="legend"><span className="tag tag-rec">Record</span> counted or logged · <span className="tag tag-est">Estimate</span> computed, always marked “about”. {mode === "live" ? "Figures are read live for a fictional sample pantry." : "Fictional demo data."}</p>
        {tab === "overview" && <Overview key={mode} onSeeDonors={() => setTab("donors")} />}
        {tab === "donors" && <Donors key={mode} />}
        {tab === "expenses" && <Expenses key={mode} />}
      </main>
    </>
  );
}
