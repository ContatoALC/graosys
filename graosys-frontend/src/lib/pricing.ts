// Prévia do preço no navegador. O servidor recalcula e é a fonte da verdade (services/pricing.ts).
export const unitKg = (unit?: string) => (unit === "ton" ? 1000 : unit === "kg" ? 1 : 60);
export const bushelKg = (product?: string) => (/milho/i.test(product || "") ? 25.4012 : 27.2155);

export function framePricePreview(
  v: { chicago: number; premium: number; exchange?: number },
  o: { product?: string; unit?: string; currency: string }
): number | null {
  if (![v.chicago, v.premium].every(Number.isFinite) || v.chicago <= 0) return null;
  const usd = ((v.chicago + v.premium) / 100 / bushelKg(o.product)) * unitKg(o.unit);
  if (o.currency === "USD") return usd;
  return v.exchange && v.exchange > 0 ? usd * v.exchange : null;
}

export const moneyFmt = (v: number, currency = "BRL") =>
  v.toLocaleString(currency === "USD" ? "en-US" : "pt-BR", { style: "currency", currency: currency === "USD" ? "USD" : "BRL", minimumFractionDigits: 2, maximumFractionDigits: 4 });

export const qtyFmt = (v: number) => Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 3 });
