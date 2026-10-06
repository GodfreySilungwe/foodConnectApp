export function matchesSearch(query, ...values) {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  return !normalizedQuery || values.some((value) =>
    String(value ?? '').toLocaleLowerCase().includes(normalizedQuery)
  );
}