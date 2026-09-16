// validateEnv() já garante, em produção, que JWT_SECRET está definido e é forte.
// O fallback abaixo só é usado em desenvolvimento local.
export const JWT_SECRET = process.env.JWT_SECRET || "dev-only-secret-do-not-use-in-production";
