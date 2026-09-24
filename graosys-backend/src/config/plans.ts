// Planos comerciais do GraoSys (valores em R$/mês, preço de tabela).
export const PLANS: Record<string, { label: string; max_users: number | null; price: number }> = {
  trial: { label: "Trial", max_users: null, price: 0 },
  essencial: { label: "Essencial", max_users: 3, price: 890 },
  profissional: { label: "Profissional", max_users: 8, price: 1690 },
  corporativo: { label: "Corporativo", max_users: 15, price: 2900 },
};

export const EXTRA_USER_PRICE = 120;
export const PLAN_KEYS = Object.keys(PLANS);

export function monthlyPrice(plan: string, activeUsers: number): number {
  const p = PLANS[plan];
  if (!p || p.max_users === null) return 0;
  return p.price + Math.max(0, activeUsers - p.max_users) * EXTRA_USER_PRICE;
}
