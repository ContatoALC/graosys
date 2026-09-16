export function pickFields<T extends Record<string, any>>(body: any, fields: (keyof T)[]): Partial<T> {
  const result: Partial<T> = {};
  if (!body) return result;
  for (const field of fields) {
    if (body[field as string] !== undefined) {
      result[field] = body[field as string];
    }
  }
  return result;
}
