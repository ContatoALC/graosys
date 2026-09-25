// Soma 1 a uma string de dígitos preservando os zeros à esquerda ("0099" -> "0100", "99" -> "100").
function incrementDigits(digits: string): string {
  const chars = digits.split("");
  let i = chars.length - 1;
  while (i >= 0) {
    if (chars[i] === "9") { chars[i] = "0"; i--; } else { chars[i] = String(Number(chars[i]) + 1); return chars.join(""); }
  }
  return "1" + chars.join("");
}

// Incrementa o número do contrato preservando prefixo, zeros à esquerda e sufixo de ano.
// Ex.: "S.0007/26" -> "S.0008/26"; "CT-99" -> "CT-100"; "A123" -> "A124".
export function nextContractNumber(last: string | null | undefined): string {
  const value = (last || "").trim();
  if (!value) return "1";

  // Ignora um sufixo de ano ("/26" ou "/2026") ao escolher qual número incrementar.
  const yearSuffix = value.match(/\/\d{2,4}$/)?.[0] ?? "";
  const body = yearSuffix ? value.slice(0, -yearSuffix.length) : value;

  const runs = [...body.matchAll(/\d+/g)];
  if (runs.length === 0) return `${value}1`;

  const run = runs[runs.length - 1];
  const start = run.index as number;
  const digits = run[0];
  const next = incrementDigits(digits);
  return body.slice(0, start) + next + body.slice(start + digits.length) + yearSuffix;
}
