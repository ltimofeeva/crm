// Маска телефона: +7 (XXX) XXX-XX-XX. Оставляем только цифры и форматируем.
export function formatPhone(value) {
  let digits = value.replace(/\D/g, "");
  // Отбрасываем ведущую 7/8 (страна) — она уже в «+7».
  if (digits.startsWith("7") || digits.startsWith("8")) digits = digits.slice(1);
  digits = digits.slice(0, 10);
  if (digits.length === 0) return "";
  let out = "+7 (" + digits.slice(0, 3);
  if (digits.length >= 4) out += ") " + digits.slice(3, 6);
  if (digits.length >= 7) out += "-" + digits.slice(6, 8);
  if (digits.length >= 9) out += "-" + digits.slice(8, 10);
  return out;
}

// Только цифры номера без кода страны — для сравнения двух номеров.
export function phoneDigits(value) {
  let d = String(value || "").replace(/\D/g, "");
  if (d.startsWith("7") || d.startsWith("8")) d = d.slice(1);
  return d;
}
