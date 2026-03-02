/**
 * 날짜를 "YYYY-MM-DD HH:mm" 형식으로 포맷
 */
export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
}

/**
 * 날짜를 "YYYY-MM-DD" 형식으로 포맷 (날짜만)
 */
export function formatDateOnly(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * 숫자를 한국 원화 형식으로 포맷 (예: 12000 → "12,000원")
 */
export function formatPrice(price: number): string {
  return `${price.toLocaleString('ko-KR')}원`;
}
