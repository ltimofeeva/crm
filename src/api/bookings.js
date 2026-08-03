// Перенос онлайн-броней в календарь приложения.
//
// Клиент записывается на публичной странице, сервер кладёт бронь в отдельный
// ящик. Здесь мы её оттуда забираем, превращаем в обычную запись календаря
// (и, если нужно, заводим клиента), после чего говорим серверу «принято».
//
// Порядок важен: сначала сохраняем у себя, и только потом подтверждаем.
// Если связь оборвётся посередине, бронь останется неподтверждённой и
// приедет снова — лучше повторить, чем потерять запись.

import { BACKEND_URL } from "../config";
import { getApiToken } from "./backend";
import { getClients, addClient, updateClient, addEvent, getEvents } from "../storage/store";
import { phoneDigits } from "../utils/phone";

async function req(pathname, options) {
  const token = getApiToken();
  if (!token) return null;
  const res = await fetch(`${BACKEND_URL}${pathname}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options?.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`booking api ${res.status}`);
  return res.json();
}

// Ссылка специалиста на свою страницу онлайн-записи.
export async function fetchBookingLink() {
  const r = await req("/api/booking/link", { method: "GET" });
  return r?.path || "";
}

// Ищем клиента по телефону; если такого нет — заводим нового.
async function linkClient(booking) {
  const digits = phoneDigits(booking.clientContact);
  const clients = await getClients();
  if (digits.length >= 10) {
    const found = clients.find((c) => phoneDigits(c.phone) === digits);
    if (found) return found;
  }
  // Совпадение по имени — только когда телефона для сверки нет.
  if (!digits) {
    const byName = clients.find(
      (c) => c.name.trim().toLowerCase() === booking.clientName.trim().toLowerCase(),
    );
    if (byName) return byName;
  }
  return addClient({
    name: booking.clientName,
    phone: digits ? booking.clientContact : "",
    contactVia: booking.contactVia || "",
    request: "",
    format: "",
  });
}

// Забрать новые брони и добавить их в календарь. Возвращает, сколько добавлено.
export async function syncBookings() {
  if (!getApiToken()) return 0;
  let pending;
  try {
    const r = await req("/api/booking/pending", { method: "GET" });
    pending = r?.bookings || [];
  } catch (e) {
    return 0; // нет связи — попробуем в следующий раз
  }
  if (!pending.length) return 0;

  const existing = await getEvents();
  const done = [];
  for (const b of pending) {
    try {
      // Защита от повтора: если бронь уже переносилась, а подтверждение
      // не дошло, второй раз запись не создаём.
      if (existing.some((e) => e.bookingId === b.id)) { done.push(b.id); continue; }

      const client = await linkClient(b);
      await addEvent({
        date: b.date,
        time: b.time,
        durationMin: b.durationMin,
        title: b.clientName,
        clientId: client?.id || null,
        clientName: b.clientName,
        productId: b.productId,
        productName: b.productName,
        price: b.price,
        bookingId: b.id,      // чтобы не продублировать при повторной попытке
        source: "online",     // запись пришла с публичной страницы
      });
      if (client && !client.contactVia && b.contactVia) {
        await updateClient(client.id, { contactVia: b.contactVia });
      }
      done.push(b.id);
    } catch (e) {
      // Эту бронь не смогли перенести — оставляем неподтверждённой,
      // приедет в следующий раз.
    }
  }

  if (done.length) {
    try { await req("/api/booking/ack", { method: "POST", body: JSON.stringify({ ids: done }) }); }
    catch (e) { /* подтверждение не дошло — повтор безопасен, см. bookingId */ }
  }
  return done.length;
}
