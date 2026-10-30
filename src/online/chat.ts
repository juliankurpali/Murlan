import { SeatId } from '../domain';

export const CHAT_MAX = 140;

export type ChatMessage = {
  id: string;
  seat: SeatId;
  name: string;
  text: string;
  at: number;
};

export function sanitizeChat(text: string): string {
  return text.replace(/\s+/g, ' ').trim().slice(0, CHAT_MAX);
}
