export function buildHistoryMenu(entries, currentIndex, direction, limit = 15) {
  const list = Array.isArray(entries) ? entries : [];
  const current = Math.max(0, Math.min(list.length - 1, Number(currentIndex) || 0));
  const normalized = list.map((entry, index) => ({
    index,
    url:String(entry?.url || ''),
    title:String(entry?.title || entry?.url || 'Página'),
    favicon:String(entry?.favicon || ''),
    current:index === current,
  }));
  const max = Math.max(1, Math.min(50, Number(limit) || 15));
  if (direction === 'back') return normalized.slice(0, current).reverse().slice(0, max);
  if (direction === 'forward') return normalized.slice(current + 1).slice(0, max);
  return [];
}
