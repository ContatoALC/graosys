import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number, currency = "BRL") {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(value);
}

export function formatDate(date: string | Date) {
  if (!date) return "-";
  // "AAAA-MM-DD" é data de calendário: new Date() a leria como meia-noite UTC e mostraria o dia anterior no Brasil.
  const ymd = typeof date === "string" && /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (ymd) return `${ymd[3]}/${ymd[2]}/${ymd[1]}`;
  return new Intl.DateTimeFormat("pt-BR").format(new Date(date));
}

export function formatCnpjCpf(value: string) {
  if (!value) return "";
  const digits = value.replace(/\D/g, "");
  if (digits.length === 11) {
    return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  }
  return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
}
