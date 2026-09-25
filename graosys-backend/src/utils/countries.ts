// Países frequentes no comércio de grãos (nome em português -> ISO 3166-1 alfa-2). Nomes fora da lista exigem o código.
export const COUNTRIES: { name: string; code: string }[] = [
  ["Brasil", "BR"], ["Argentina", "AR"], ["Paraguai", "PY"], ["Uruguai", "UY"], ["Bolívia", "BO"], ["Chile", "CL"], ["Colômbia", "CO"],
  ["Peru", "PE"], ["Venezuela", "VE"], ["Equador", "EC"], ["México", "MX"], ["Estados Unidos", "US"], ["Canadá", "CA"], ["China", "CN"],
  ["Japão", "JP"], ["Coreia do Sul", "KR"], ["Índia", "IN"], ["Vietnã", "VN"], ["Tailândia", "TH"], ["Indonésia", "ID"], ["Malásia", "MY"],
  ["Filipinas", "PH"], ["Bangladesh", "BD"], ["Paquistão", "PK"], ["Turquia", "TR"], ["Egito", "EG"], ["Marrocos", "MA"], ["Argélia", "DZ"],
  ["Arábia Saudita", "SA"], ["Emirados Árabes Unidos", "AE"], ["Irã", "IR"], ["Iraque", "IQ"], ["Israel", "IL"], ["Rússia", "RU"],
  ["Ucrânia", "UA"], ["Alemanha", "DE"], ["França", "FR"], ["Itália", "IT"], ["Espanha", "ES"], ["Portugal", "PT"], ["Países Baixos", "NL"],
  ["Bélgica", "BE"], ["Reino Unido", "GB"], ["Polônia", "PL"],
].map(([name, code]) => ({ name, code }));

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
const BY_NAME = new Map(COUNTRIES.map((c) => [norm(c.name), c]));

// Resolve país e código ISO. Sem país nem código: Brasil/BR. Retorna erro amigável quando não dá para inferir.
export function resolveCountry(country?: unknown, code?: unknown): { country: string; country_code: string } | { error: string } {
  const name = typeof country === "string" ? country.trim() : "";
  const raw = typeof code === "string" ? code.trim().toUpperCase() : "";
  if (raw && !/^[A-Z]{2}$/.test(raw)) return { error: "Código do país inválido: use 2 letras (ex.: BR, PY, AR)" };
  if (!name && !raw) return { country: "Brasil", country_code: "BR" };
  const known = name ? BY_NAME.get(norm(name)) : undefined;
  const finalCode = raw || known?.code;
  if (!finalCode) return { error: "Informe o código do país (2 letras, ex.: PY) para este país" };
  const finalName = known?.name || name || COUNTRIES.find((c) => c.code === finalCode)?.name || finalCode;
  return { country: finalName, country_code: finalCode };
}
