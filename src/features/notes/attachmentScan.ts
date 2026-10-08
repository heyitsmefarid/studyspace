import { AppError } from '@/lib/errors';

export const MAX_SCAN_BYTES = 8 * 1024 * 1024;
export const SCANNABLE_TYPES = new Set(['application/pdf', 'text/plain', 'text/csv', 'text/markdown', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/avif', 'image/heic']);
export function assertScannable(size: number, mimeType: string): void { if (size > MAX_SCAN_BYTES) throw new AppError('Files over 8 MB cannot be scanned yet.'); if (!SCANNABLE_TYPES.has(mimeType.split(';')[0]!.toLowerCase())) throw new AppError('Nova cannot scan this file type yet.'); }
export function bytesToBase64(bytes: Uint8Array): string { let binary = ''; for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(binary); }
