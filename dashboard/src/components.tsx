import { useId, useState, type ReactNode } from "react";

/** A logged fact: counted by staff or recorded when it happened. */
export const Record = ({ children }: { children: ReactNode }) => <span className="rec">{children}</span>;

/** A computed number. Always shows the word "about" or "estimate" and the formula on tap. */
export function Estimate({ children, formula }: { children: ReactNode; formula: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <span className="est-wrap">
      <span className="est">{children}</span>{" "}
      <button type="button" className="why" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>How we got this</button>
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
