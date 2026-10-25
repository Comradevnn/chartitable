import { useEffect, useId, useRef, useState, type RefObject } from "react";
import { describeError, getDonors, previewThankYou, sendThankYou, useCapabilities, useDataMode, writeBlockedReason, UNSUPPORTED_REASON } from "./data";
import type { DashDonor, ThankYouPreview, ThankYouResult, ThankYouStatus } from "./types";
import { Busy, Skel } from "./components";

export const NOTE_MAX = 500;

/** Why sending is off right now (fallback / backend not deployed), or null. Demo mode never sends, but the flow still runs. */
export function useSendBlocked(): string | null {
  const mode = useDataMode();
  const caps = useCapabilities();
  if (mode === "fallback") return writeBlockedReason();
  if (mode === "live" && !caps.thankYou) return UNSUPPORTED_REASON;
  return null;
}

/**
 * A native modal <dialog>: focus moves in, Tab stays inside, Esc closes. Focus goes back to the control that opened it
 * (or to `fallback` if that control is gone, e.g. the row stopped showing the button once the donor was thanked).
 * `canDismiss` false blocks Esc while a send is in flight.
 */
function useModal(onClose: () => void, canDismiss: boolean, returnTo?: HTMLElement | null, fallback?: () => void): { ref: RefObject<HTMLDialogElement | null>; props: object } {
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<Element | null>(returnTo ?? document.activeElement); // Safari doesn't focus a button on click, so the caller passes it
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    return () => { if (d?.open) d.close(); };
  }, []);
  return {
    ref,
    props: {
      onCancel: (e: React.SyntheticEvent) => { if (!canDismiss) e.preventDefault(); },
      onClose: () => {
        const el = opener.current as HTMLElement | null;
        if (el && el.isConnected) el.focus(); else fallback?.();
        onClose();
      },
      onKeyDown: (e: React.KeyboardEvent) => { if (e.key === "Escape") e.stopPropagation(); },
    },
  };
}

const OUTCOME: Record<ThankYouStatus, string> = {
  sent: "Sent",
  skipped_not_allowlisted: "Not sent",
  skipped_no_email: "Not sent",
  skipped_rate_limited: "Not sent",
  failed: "Failed",
  not_configured: "Not sent",
};

type Outcome = { kind: "result"; r: ThankYouResult } | { kind: "error"; msg: string };

/** One donor: review the draft, add an optional staff note, send. Every outcome is shown in plain words. */
export function ThankYouDialog({ donorId, name, onSent, onClose, returnTo, fallbackFocus }: {
  donorId: string; name: string; onSent: (donors: DashDonor[]) => void; onClose: () => void; returnTo?: HTMLElement | null; fallbackFocus?: () => void;
}) {
  const [draft, setDraft] = useState<ThankYouPreview | null>(null);
  const [loadErr, setLoadErr] = useState("");
  const [tries, setTries] = useState(0);
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [out, setOut] = useState<Outcome | null>(null);
  const mode = useDataMode();
  const blocked = useSendBlocked();
  const { ref, props } = useModal(onClose, !sending, returnTo, fallbackFocus);
  const titleId = useId();
  const closeBtn = useRef<HTMLButtonElement>(null);
  const sendBtn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let alive = true;
    setDraft(null); setLoadErr("");
    previewThankYou(donorId).then((d) => { if (alive) setDraft(d); }, (e) => { if (alive) setLoadErr(describeError(e)); });
    return () => { alive = false; };
  }, [donorId, tries]);

  const sent = out?.kind === "result" && out.r.status === "sent";
  // After a clear "not sent" for a reason retrying won't fix, the button stays off; a failure or a lost connection may be retried.
  const final = out?.kind === "result" && out.r.status !== "failed";
  const disabledWhy = blocked ?? (draft && !draft.canSend ? draft.reason || "This email can't be sent right now." : null);
  const cantSend = sending || !draft || !!disabledWhy || sent || final;

  // The Send button is disabled while sending, which drops focus. Afterwards: Close if we're done, Send again if a retry makes sense.
  useEffect(() => {
    if (!out || sending) return;
    (sent || final ? closeBtn : sendBtn).current?.focus();
  }, [out, sending, sent, final]);

  async function send() {
    if (cantSend) return;
    setSending(true); setOut(null);
    try {
      const r = await sendThankYou(donorId, note);
      setOut({ kind: "result", r });
      if (r.status === "sent" && r.donors) onSent(r.donors);
      else if (r.status === "sent") onSent(await getDonors());
    } catch (e) {
      setOut({ kind: "error", msg: "Couldn't send. " + describeError(e) + " Nothing was marked as thanked." });
    } finally {
      setSending(false);
    }
  }

  return (
    <dialog ref={ref} className="modal" aria-labelledby={titleId} {...props}>
      <h3 id={titleId}>Send a thank-you to {name}</h3>
      {mode === "demo" && <p className="modal-note">Demo mode: you can review the email, but nothing is sent.</p>}
      <p className="modal-to"><span className="modal-k">To</span> the donor (address hidden)</p>
      {loadErr ? (
        <div role="alert" className="modal-err">
          <p>Couldn't load the draft. {loadErr}</p>
          <button type="button" className="mini" onClick={() => setTries(tries + 1)}>Try again</button>
        </div>
      ) : !draft ? (
        <Busy label="Loading the draft…"><div className="skel-col"><Skel w="60%" /><Skel h="7rem" /></div></Busy>
      ) : (
        <>
          <p className="modal-subject"><span className="modal-k">Subject</span> {draft.subject}</p>
          <div className="draft" role="group" aria-label="Email draft" tabIndex={0}>{draft.body}</div>
          <label className="modal-note-field">Add a short note from staff (optional)
            <textarea rows={3} maxLength={NOTE_MAX} value={note} onChange={(e) => setNote(e.target.value)} disabled={sending || sent} aria-describedby={titleId + "-count"} />
            <span id={titleId + "-count"} className="muted modal-count">{note.length} of {NOTE_MAX} characters. Your note is added to the end of the email.</span>
          </label>
        </>
      )}
      {disabledWhy && !sent && <p className="modal-why" role="note">Can't send: {disabledWhy}</p>}
      {out?.kind === "error" && <p className="err" role="alert">{out.msg}</p>}
      {out?.kind === "result" && (out.r.status === "sent"
        ? <p className="ok" role="status">Sent. {name} is now marked as thanked.</p>
        : <p className="err" role="alert">{OUTCOME[out.r.status]}: {out.r.reason} Nothing was marked as thanked.</p>)}
      <div className="modal-actions">
        <button type="button" className="mini" ref={closeBtn} onClick={() => ref.current?.close()} disabled={sending}>{out && (sent || final) ? "Close" : "Cancel"}</button>
        <button type="button" className="primary" ref={sendBtn} onClick={send} disabled={cantSend} aria-busy={sending}>{sending ? "Sending…" : "Send thank-you"}</button>
      </div>
    </dialog>
  );
}

type Row = { id: string; name: string; res?: Outcome | "skipped" };

/** Confirm, then send to each donor who still needs a thank-you, one at a time, and list what happened to each. */
export function ThankEveryoneDialog({ people: initial, onDone, onClose, returnTo, fallbackFocus }: {
  people: { id: string; name: string }[]; onDone: (donors: DashDonor[]) => void; onClose: () => void; returnTo?: HTMLElement | null; fallbackFocus?: () => void;
}) {
  const [people] = useState(initial); // frozen: the donor list changes underneath once emails go out
  const [rows, setRows] = useState<Row[]>(() => people.map((p) => ({ ...p })));
  const [phase, setPhase] = useState<"confirm" | "running" | "done">("confirm");
  const [at, setAt] = useState(0);
  const stop = useRef(false);
  const mode = useDataMode();
  const blocked = useSendBlocked();
  const { ref, props } = useModal(onClose, phase !== "running", returnTo, fallbackFocus);
  const titleId = useId();
  const title = useRef<HTMLHeadingElement>(null);
  const actionBtn = useRef<HTMLButtonElement>(null);
  const n = people.length;
  // "Send N emails" unmounts when sending starts: park focus on the heading, then on Close when the results are in.
  useEffect(() => {
    if (phase === "running") title.current?.focus();
    else if (phase === "done") actionBtn.current?.focus();
  }, [phase]);

  async function run() {
    if (phase !== "confirm" || blocked) return;
    setPhase("running");
    stop.current = false;
    let anySent = false;
    let halted = false;
    for (let i = 0; i < people.length; i++) {
      if (stop.current || halted) { setRows((rs) => rs.map((r, j) => (j === i ? { ...r, res: "skipped" } : r))); continue; }
      setAt(i);
      let res: Outcome;
      try {
        const r = await sendThankYou(people[i].id);
        res = { kind: "result", r };
        if (r.status === "sent") anySent = true;
      } catch (e) {
        res = { kind: "error", msg: describeError(e) };
        halted = true; // a connection or PIN problem will hit every remaining donor the same way
      }
      setRows((rs) => rs.map((r, j) => (j === i ? { ...r, res } : r)));
    }
    if (anySent) onDone(await getDonors());
    setPhase("done");
  }

  const sentN = rows.filter((r) => typeof r.res === "object" && r.res.kind === "result" && r.res.r.status === "sent").length;
  const attempted = rows.filter((r) => r.res && r.res !== "skipped").length;

  return (
    <dialog ref={ref} className="modal" aria-labelledby={titleId} {...props}>
      <h3 id={titleId} ref={title} tabIndex={-1}>Thank everyone who needs it</h3>
      {phase === "confirm" && (
        <>
          <p>This sends a thank-you email to <strong>{n} {n === 1 ? "donor" : "donors"}</strong>, one at a time, using each one's standard draft (no staff note). Addresses stay hidden.</p>
          <p className="muted">Anyone who can't be emailed is skipped and listed afterwards with the reason. Nobody is marked as thanked unless their email was sent.</p>
          {mode === "demo" && <p className="modal-note">Demo mode: nothing is actually sent, and the results will say so.</p>}
          {blocked && <p className="modal-why" role="note">Can't send: {blocked}</p>}
        </>
      )}
      {phase === "running" && <p role="status">Sending {at + 1} of {n}…</p>}
      {phase === "done" && (
        <p role="status" className={sentN > 0 ? "ok" : undefined}>
          {sentN} of {n} sent{attempted < n ? `, ${n - attempted} not attempted` : ""}. {sentN < n ? "Reasons are listed below." : ""}
        </p>
      )}
      {phase !== "confirm" && (
        <ul className="results" aria-label="Results">
          {rows.map((r) => (
            <li key={r.id}>
              <span className="results-name">{r.name}</span>
              <span className="results-out">
                {!r.res ? (phase === "running" ? "Waiting" : "") :
                  r.res === "skipped" ? "Not attempted" :
                  r.res.kind === "error" ? "Not sent" : OUTCOME[r.res.r.status]}
              </span>
              {r.res && r.res !== "skipped" && (r.res.kind === "error" || r.res.r.status !== "sent") && (
                <span className="results-why">{r.res.kind === "error" ? r.res.msg : r.res.r.reason}</span>
              )}
            </li>
          ))}
        </ul>
      )}
      <div className="modal-actions">
        {phase === "running"
          ? <button type="button" className="mini" ref={actionBtn} onClick={() => { stop.current = true; }}>Stop after this one</button>
          : <button type="button" className="mini" ref={actionBtn} onClick={() => ref.current?.close()}>{phase === "done" ? "Close" : "Cancel"}</button>}
        {phase === "confirm" && <button type="button" className="primary" onClick={run} disabled={!!blocked || n === 0}>Send {n} {n === 1 ? "email" : "emails"}</button>}
      </div>
    </dialog>
  );
}
