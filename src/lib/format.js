// src/lib/format.js — форматирование чисел.

const THIN = ' '; // узкий неразрывный пробел

/** 1840 -> "1 840" (разделитель разрядов). */
export function groupNum(n) {
  const v = Math.round(Number(n) || 0);
  const sign = v < 0 ? '-' : '';
  return (
    sign +
    String(Math.abs(v)).replace(/\B(?=(\d{3})+(?!\d))/g, THIN)
  );
}
