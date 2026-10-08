import { describe, expect, it } from 'vitest';
import { AppError } from '@/lib/errors';
import { assertScannable, bytesToBase64 } from './attachmentScan';
describe('attachment scanning', () => { it('accepts supported files', () => expect(() => assertScannable(1024, 'application/pdf')).not.toThrow()); it('rejects oversized and unsafe files', () => { expect(() => assertScannable(9 * 1024 * 1024, 'application/pdf')).toThrow(AppError); expect(() => assertScannable(1024, 'application/zip')).toThrow(AppError); }); it('encodes bytes', () => expect(bytesToBase64(new Uint8Array([0, 1, 255]))).toBe('AAH/')); });
