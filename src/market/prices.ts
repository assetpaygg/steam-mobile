// Steam's own frontend GetPriceValueAsInt (via SCM-autoseller): a formatted price ("2,25€", "$19.99",
// "1 245,00€", "5,--€") → integer cents, 0 when unparseable. Currency-agnostic.
export function getPriceValueAsInt(strAmount: string | null | undefined): number {
  if (!strAmount) return 0;

  let amount = String(strAmount);
  // Either comma or period may be the decimal mark.
  amount = amount.replace(/,/g, ".");
  // "5,--€" → "5.--€" → "5.00€"
  amount = amount.replace(".--", ".00");
  amount = amount.replace(/[^\d.]/g, "");

  // Keep only the last period, so "1,147.6" works.
  if (amount.indexOf(".") !== -1) {
    const segments = amount.split(".");
    const last = segments[segments.length - 1] ?? "";
    if (!Number.isNaN(Number(last)) && last.length === 3 && segments[segments.length - 2] !== "0") {
      // Only thousands separators were entered: "1.147" → 1147 (Steam: better to overprice).
      amount = segments.join("");
    } else {
      amount = `${segments.slice(0, -1).join("")}.${last}`;
    }
  }

  const cents = Number.parseFloat(amount) * 100;
  // Epsilon guards float error (2.25 * 100 === 224.99999999999997).
  return Math.max(Math.floor(Number.isNaN(cents) ? 0 : cents + 0.000001), 0);
}
