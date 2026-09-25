import { GrainContract } from "../app/entities/GrainContract";
import { parseNumber, round, unitKg } from "./pricing";

// Recalcula quantidade em kg, valor total e comissões. Em contrato a fixar, só a parte já fixada entra no valor
// (fixedValue) e na base da comissão; o restante entra conforme novas fixações.
export function applyTotals(c: GrainContract, fixedValue?: number): void {
  const perUnitKg = unitKg(c.type_quantity);
  const toFix = c.price_type === "to_fix";
  const contractQty = Number(c.quantity || 0);
  const qty = toFix ? Number(c.fixed_quantity || 0) : contractQty;
  const total = toFix ? (fixedValue ?? Number(c.total_contract_value || 0)) : qty * Number(c.price || 0);

  const kg = qty * perUnitKg;
  const sacks = kg / 60;
  const tons = kg / 1000;
  const commission = (type: string | null, raw: unknown) => {
    const v = parseNumber(raw);
    if (!v) return 0;
    if (type === "%") return (total * v) / 100;
    if (type === "R$/sc") return sacks * v;
    if (type === "R$/ton") return tons * v;
    return 0;
  };

  c.quantity_kg = round(contractQty * perUnitKg);
  c.quantity_bag = round((contractQty * perUnitKg) / 60);
  c.total_contract_value = round(total);
  c.commission_seller_contract_value = round(commission(c.type_commission_seller, c.commission_seller));
  c.commission_buyer_contract_value = round(commission(c.type_commission_buyer, c.commission_buyer));
  c.commission_contract = round(c.commission_seller_contract_value + c.commission_buyer_contract_value);
}
