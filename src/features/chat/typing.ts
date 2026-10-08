export const TYPING_SEND_EVERY_MS = 2000;
export const TYPING_SHOW_MS = 4000;
export const shouldSendTyping = (lastSent: number | null, now: number) => lastSent === null || now - lastSent >= TYPING_SEND_EVERY_MS;
