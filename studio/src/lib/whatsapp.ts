/**
 * Indian mobile numbers: accepts '98765 43210', '+91 98765-43210',
 * '09876543210' and '919876543210'. Returns the 10 digits, or null if it
 * isn't a valid Indian mobile number.
 */
export function normalizePhone(input: string): string | null {
  let d = input.replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
  else if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  return /^[6-9]\d{9}$/.test(d) ? d : null;
}

/** '9876543210' → '98765 43210' */
export function formatPhone(phone: string): string {
  const ten = normalizePhone(phone);
  return ten ? `${ten.slice(0, 5)} ${ten.slice(5)}` : phone;
}

/** Opens WhatsApp on that number with the message already typed, ready to send. */
export function waLink(phone: string, text: string): string | null {
  const ten = normalizePhone(phone);
  if (!ten) return null;
  return `https://wa.me/91${ten}?text=${encodeURIComponent(text)}`;
}

/** Opens WhatsApp to pick a chat yourself (e.g. sending a day summary). */
export function waShareLink(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export function telLink(phone: string): string | null {
  const ten = normalizePhone(phone);
  return ten ? `tel:+91${ten}` : null;
}
