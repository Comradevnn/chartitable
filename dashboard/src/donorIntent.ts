// One-shot hint from Overview to Donors: open the list already filtered to "Needs a thank-you".
// Read on mount and cleared by Donors; kept in module memory only (no URL, no storage, nothing about any donor).
let pending: "needs" | null = null;
export const askDonorView = (v: "needs" | null) => { pending = v; };
export const peekDonorView = () => pending;
