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

// Fator de conversão padrão: bushels por tonelada (soja/trigo 36,7437; milho 39,3683).
export const defaultConversionFactor = (productName?: string | null) => 1000 / bushelKg(productName);

// factor (bushels/t) e fobbings (US$/t) são opcionais: sem eles vale o fator padrão do produto e fobbings zero.
export interface FrameInput { chicago: number; premium: number; exchange?: number | null; factor?: number | null; fobbings?: number | null }

// PPE (preço de paridade de exportação), em US$ por tonelada: (Chicago + prêmio) / 100 × fator − fobbings.
export function framePpe(input: FrameInput, productName?: string | null): number {
  const factor = input.factor && input.factor > 0 ? input.factor : defaultConversionFactor(productName);
  return ((input.chicago + input.premium) / 100) * factor - (input.fobbings || 0);
}

// Preço por unidade do contrato (sc, ton ou kg), na moeda do contrato.
export function framePrice(input: FrameInput, opts: { product?: string | null; unit?: string | null; currency: string }): number {
  const custom = (input.factor && input.factor > 0) || (input.fobbings && input.fobbings !== 0);
  const usdPerKg = custom ? framePpe(input, opts.product) / 1000 : (input.chicago + input.premium) / 100 / bushelKg(opts.product);
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
