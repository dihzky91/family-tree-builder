import { z } from 'zod';

/** Shared password strength schema used across auth and settings forms. */
export const passwordSchema = z
  .string()
  .min(8, 'Password minimal 8 karakter')
  .regex(/[A-Z]/, 'Password harus mengandung minimal 1 huruf besar')
  .regex(/[a-z]/, 'Password harus mengandung minimal 1 huruf kecil')
  .regex(/[0-9]/, 'Password harus mengandung minimal 1 angka')
  .regex(/[^A-Za-z0-9]/, 'Password harus mengandung minimal 1 karakter khusus (!@#$%^&*)');

/** Returns per-rule validation status for live password strength checklists. */
export function getPasswordChecks(password: string) {
  return [
    { label: 'Minimal 8 karakter', valid: password.length >= 8 },
    { label: 'Memiliki huruf besar', valid: /[A-Z]/.test(password) },
    { label: 'Memiliki huruf kecil', valid: /[a-z]/.test(password) },
    { label: 'Memiliki angka', valid: /[0-9]/.test(password) },
    { label: 'Memiliki karakter khusus', valid: /[^A-Za-z0-9]/.test(password) },
  ];
}
