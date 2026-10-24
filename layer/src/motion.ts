// Motion (T28, plan section 4). Everything here is gated on motionOk(): reduced motion or a hidden
// tab means no style tag, no classes, no overlays, and the final text is simply there.
import MOTION_CSS from "./motion.css";

const COUNT_MS = 700;
const COUNT_STEPS = 30;
const PIN_RELEASE_MS = 600;

type VtDocument = Document & { startViewTransition?: (update: () => void) => { finished?: Promise<unknown> } };

export function motionOk(): boolean {
  try {
    return (
      typeof matchMedia === "function" &&
      !matchMedia("(prefers-reduced-motion: reduce)").matches &&
      document.visibilityState === "visible"
    );
  } catch {
    return false;
  }
}

export function injectMotionStyle(doc: Document): void {
  if (doc.head.querySelector("style[data-ct-motion-style]")) return;
  const style = doc.createElement("style");
  style.setAttribute("data-ct-motion-style", "");
  style.textContent = MOTION_CSS;
  doc.head.appendChild(style);
}

// Runs `update` (the first region paint plus hooks) with the recognition swap around it.
export function swap(doc: Document, update: () => void): void {
  if (!motionOk()) return update();
  injectMotionStyle(doc);
  // Pin each region to its current height so the swap cannot jump the layout; release afterwards.
  const pinned: Array<[HTMLElement, string]> = [];
  for (const el of Array.from(doc.querySelectorAll<HTMLElement>("[data-impact-region]"))) {
    if (el.offsetHeight > 0) {
      pinned.push([el, el.style.minHeight]);
      el.style.minHeight = el.offsetHeight + "px";
    }
  }
  const root = doc.documentElement;
  const vt = (doc as VtDocument).startViewTransition;
  // Without View Transitions: a short CSS fade on the ready regions instead.
  if (typeof vt !== "function") root.setAttribute("data-ct-fade", "");
  setTimeout(() => {
    for (const [el, min] of pinned) el.style.minHeight = min;
    root.removeAttribute("data-ct-fade");
  }, PIN_RELEASE_MS);
  if (typeof vt !== "function") return update();
  // A View Transition waits for a rendered frame; in a tab that isn't rendering its callback can stall
  // (or the call can throw), which would leave the donor on the stranger page. Run the swap exactly once,
  // whichever comes first: the transition's callback or a short fallback timer.
  let done = false;
  const once = (): void => {
    if (!done) {
      done = true;
      update();
    }
  };
  setTimeout(once, 400);
  try {
    vt.call(doc, once);
  } catch {
    once();
  }
}

// Sets up count / draw / reveal inside freshly painted regions. mode "first": everything animates once
// it enters the viewport. mode "update" (live repaint): only new records count up and estimates redraw;
// content already on screen is never hidden again.
export function enhance(roots: Element[], mode: "first" | "update"): void {
  if (!roots.length || !motionOk()) return;
  injectMotionStyle(document);
  if (typeof IntersectionObserver !== "function") return; // no observer: final values, no motion
  // One observer per element: fires once when it is 20% in view, then disconnects.
  const watch = (el: Element, run: () => void): void => {
    const obs = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        obs.disconnect();
        run();
      },
      { threshold: 0.2 },
    );
    obs.observe(el);
  };
  for (const root of roots) {
    // Live arrival (the live module marks new record items data-ct-new): soft insert animation, and
    // the ring on a host's .ct-new-tag, in CSS.
    for (const el of Array.from(root.querySelectorAll('[data-ct-new=""]'))) el.classList.add("ct-arrive");
    for (const el of Array.from(root.querySelectorAll("[data-ct-animate]"))) {
      const kind = el.getAttribute("data-ct-animate");
      if (kind === "count") countUp(el, mode, watch);
      else if (kind === "draw" || (kind === "reveal" && mode === "first")) {
        el.classList.add("ct-pre");
        watch(el, () => {
          el.classList.remove("ct-pre");
          el.classList.add("ct-in");
        });
      }
    }
  }
}

function countUp(el: Element, mode: string, watch: (el: Element, run: () => void) => void): void {
  const item = el.closest('[data-ct-kind="record"]');
  // Records only. Estimates never count up: counting implies precision.
  if (!item || el.closest('[data-ct-kind="estimate"],.ct-estimate,[data-ct-animate="draw"]')) return;
  if (mode === "update" && item.getAttribute("data-ct-new") !== "") return;
  const text = el.textContent || "";
  const m = /\d[\d,]*/.exec(text);
  const target = m ? parseInt(m[0].replace(/,/g, ""), 10) : 0;
  if (!m || target < 2) return;
  const real = document.createElement("span");
  real.className = "ct-count-real";
  real.append(...Array.from(el.childNodes));
  const overlay = document.createElement("span");
  overlay.className = "ct-count-ov";
  overlay.setAttribute("aria-hidden", "true");
  const show = (n: number): void => {
    overlay.textContent = text.slice(0, m.index) + n + text.slice(m.index + m[0].length);
  };
  show(0);
  el.classList.add("ct-count");
  el.append(overlay, real); // overlay first: out of flow, so it sits at the start of the element
  watch(el, () => {
    const steps = Math.min(COUNT_STEPS, target);
    let i = 0;
    const step = (): void => {
      show(++i < steps ? Math.round(target * (1 - Math.pow(1 - i / steps, 3))) : target);
      if (i < steps) setTimeout(step, COUNT_MS / steps);
      else {
        // Done: the real text was never removed; drop the overlay.
        overlay.remove();
        el.classList.remove("ct-count");
      }
    };
    setTimeout(step, COUNT_MS / steps);
  });
}
