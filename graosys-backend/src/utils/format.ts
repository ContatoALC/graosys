// `locale` força o formato dos números (modelo em inglês); sem ele, dólar sai em en-US e real em pt-BR.
export const formatCurrency = (value: string | number, currency: string, locale?: string): string => {
  const numberValue = typeof value === "number" ? value : parseFloat(value);
  if (isNaN(numberValue)) return "";
  const isDollar = currency === "Dólar" || currency === "USD";
  return new Intl.NumberFormat(locale ?? (isDollar ? "en-US" : "pt-BR"), {
    style: "currency",
    currency: isDollar ? "USD" : "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numberValue);
};

export const insertMaskInCnpj = (cnpj: string) =>
  cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/g, "$1.$2.$3/$4-$5");

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

export const formatDateWithLongMonth = (dateString: string): string => {
  const [day, month, year] = dateString.split("/");
  const monthName = MONTHS[parseInt(month) - 1];
  if (!day || !monthName || !year) return dateString;
  return `${day} de ${monthName} de ${year}`;
};

export const formatQuantity = (value: number | string, locale = "pt-BR"): string => {
  const n = typeof value === "number" ? value : parseFloat(value);
  if (isNaN(n)) return "";
  return new Intl.NumberFormat(locale, { minimumFractionDigits: 0, maximumFractionDigits: 3 }).format(n);
};
