// Fórmulas de contratos a fixar. Fonte da conversão: bushel = 27,2155 kg (soja/trigo) e 25,4012 kg (milho);
// preço físico = (Chicago + prêmio) em centavos de dólar por bushel, convertido para a unidade do contrato e para R$ pelo câmbio.
export const round = (v: number, digits = 4) => Math.round((v + Number.EPSILON) * 10 ** digits) / 10 ** digits;

export function unitKg(unit?: string | null): number {
  switch ((unit || "sc").toLowerCase()) {
    case "ton": case "t": return 1000;
    case "kg": return 1;
    default: return 60; // sc
  }
}

export function bushelKg(productName?: string | null): number {
  return /milho/i.test(productName || "") ? 25.4012 : 27.2155;
}

export interface FrameInput { chicago: number; premium: number; exchange?: number | null }

// Preço por unidade do contrato (sc, ton ou kg), na moeda do contrato.
export function framePrice(input: FrameInput, opts: { product?: string | null; unit?: string | null; currency: string }): number {
  const usdPerKg = (input.chicago + input.premium) / 100 / bushelKg(opts.product);
  const usdPerUnit = usdPerKg * unitKg(opts.unit);
  if (opts.currency === "USD") return round(usdPerUnit);
  if (!input.exchange || input.exchange <= 0) throw new Error("Câmbio é obrigatório para contratos em reais");
  return round(usdPerUnit * input.exchange);
}

export function parseNumber(raw: unknown): number {
  if (raw === null || raw === undefined || raw === "") return 0;
  let s = String(raw).replace(/[^0-9,.\-]/g, "");
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}
