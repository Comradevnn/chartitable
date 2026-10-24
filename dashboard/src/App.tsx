import { useEffect, useRef, useState, type FormEvent } from "react";
import { loggedIn, login, logout } from "./data";
import { charityName } from "./mock/data";
import { Overview } from "./Overview";
import { Donors } from "./Donors";
import { Expenses } from "./Expenses";

type Tab = "overview" | "donors" | "expenses";
const TABS: [Tab, string][] = [["overview", "Overview"], ["donors", "Donors"], ["expenses", "Expenses"]];

function Gate({ onIn }: { onIn: () => void }) {
  const [pin, setPin] = useState("");
  const [err, setErr] = useState(false);
  async function go(e: FormEvent) {
    e.preventDefault();
    if (await login(pin)) onIn(); else setErr(true);
  }
  return (
    <main className="gate">
      <form onSubmit={go}>
        <h1>{charityName}</h1>
        <p>Staff sign-in. This demo accepts any PIN; real sign-in is not part of it.</p>
        <label>Staff PIN<input type="password" inputMode="numeric" autoComplete="off" value={pin} onChange={(e) => { setPin(e.target.value); setErr(false); }} aria-invalid={err} /></label>
        {err && <p className="err" role="alert">Enter the PIN to continue.</p>}
        <button className="primary" type="submit">Open dashboard</button>
      </form>
    </main>
  );
}

export function App() {
  const [ok, setOk] = useState(loggedIn());
  const [tab, setTab] = useState<Tab>("overview");
  const main = useRef<HTMLElement>(null);
  // After sign-in, land focus on the content. Tab changes leave focus on the nav button so keyboard users keep their place.
  useEffect(() => { if (ok) main.current?.focus(); }, [ok]);
  if (!ok) return <Gate onIn={() => setOk(true)} />;
  return (
    <>
      <header className="top">
        <h1 className="brand">{charityName}</h1>
        <nav aria-label="Dashboard sections">
          {TABS.map(([k, v]) => <button key={k} className={tab === k ? "navbtn on" : "navbtn"} aria-current={tab === k ? "page" : undefined} onClick={() => setTab(k)}>{v}</button>)}
        </nav>
        <button className="link" onClick={() => { logout(); setOk(false); }}>Sign out</button>
      </header>
      <main className="page" ref={main} tabIndex={-1} aria-label={TABS.find(([k]) => k === tab)![1]}>
        <p className="legend"><span className="tag tag-rec">Record</span> counted or logged · <span className="tag tag-est">Estimate</span> computed, always marked “about”. Fictional demo data.</p>
        {tab === "overview" && <Overview onSeeDonors={() => setTab("donors")} />}
        {tab === "donors" && <Donors />}
        {tab === "expenses" && <Expenses />}
      </main>
    </>
  );
}
