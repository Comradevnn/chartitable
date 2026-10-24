import { useId, useState, type ReactNode } from "react";

/** A logged fact: counted by staff or recorded when it happened. */
export const Record = ({ children }: { children: ReactNode }) => <span className="rec">{children}</span>;

/**
 * A computed number. Always shows the word "about" or "estimate"; the formula opens on hover, on keyboard focus,
 * and on tap/click (tap again to close; Escape closes too). It is a popover, so opening it moves nothing.
 */
export function Estimate({ children, formula }: { children: ReactNode; formula: string }) {
  const [pinned, setPinned] = useState(false); // tap/click keeps it open
  const [hover, setHover] = useState(false);
  const [focus, setFocus] = useState(false);
  const [muted, setMuted] = useState(false); // user closed it while still hovering/focused
  const id = useId();
  const open = pinned || ((hover || focus) && !muted);
  function toggle() {
    if (pinned) { setPinned(false); setMuted(true); } else { setPinned(true); setMuted(false); }
  }
  return (
    <span className="est-wrap" onMouseEnter={() => setHover(true)} onMouseLeave={() => { setHover(false); if (!focus) setMuted(false); }}>
      <span className="est">{children}</span>{" "}
      <button
        type="button" className="why" aria-expanded={open} aria-controls={id}
        onClick={toggle}
        onFocus={() => setFocus(true)}
        onBlur={() => { setFocus(false); setPinned(false); if (!hover) setMuted(false); }}
        onKeyDown={(e) => { if (e.key === "Escape" && open) { e.stopPropagation(); setPinned(false); setMuted(true); } }}
      >How we got this</button>
      <span id={id} className="formula" role="note" hidden={!open}>{formula}</span>
    </span>
  );
}

export const Tile = ({ label, tag, children, note }: { label: string; tag: "Record" | "Estimate"; children: ReactNode; note?: ReactNode }) => (
  <div className={"tile " + (tag === "Record" ? "tile-rec" : "tile-est")}>
    <p className="tile-label">{label} <span className={"tag " + (tag === "Record" ? "tag-rec" : "tag-est")}>{tag}</span></p>
    <p className="tile-value">{children}</p>
    {note && <p className="tile-note">{note}</p>}
  </div>
);

export const Empty = ({ title, children }: { title: string; children: ReactNode }) => (
  <div className="empty"><h3>{title}</h3><p>{children}</p></div>
);

/** A calm placeholder block while data loads. Sized by the caller so the real content lands without a jump. */
export const Skel = ({ w = "100%", h = "1rem" }: { w?: string; h?: string }) => <span className="skel" style={{ width: w, height: h }} aria-hidden="true" />;

/** Wraps skeleton content: one polite announcement, hidden shapes. */
export const Busy = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="busy" aria-busy="true">
    <p className="sr-only" role="status">{label}</p>
    {children}
  </div>
);
