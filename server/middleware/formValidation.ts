import type { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

const STRICT_EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

// In-memory duplicate submission store (60-second sliding TTL)
interface DuplicateRecord {
  timestamp: number;
}
const duplicateSubmissions = new Map<string, DuplicateRecord>();

// Clean up stale duplicate hashes periodically (every 2 minutes)
const duplicatePruneInterval = setInterval(() => {
  const now = Date.now();
  for (const [hash, record] of duplicateSubmissions.entries()) {
    if (now - record.timestamp > 60 * 1000) {
      duplicateSubmissions.delete(hash);
    }
  }
}, 2 * 60 * 1000);
if (duplicatePruneInterval.unref) {
  duplicatePruneInterval.unref();
}

/**
 * Masks an email address for privacy-safe operational logging.
 * Example: 'karshhtech@gmail.com' -> 'kar***h@gmail.com'
 */
export function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return '***@unknown';
  const [local, domain] = email.split('@');
  if (local.length <= 2) {
    return `***@${domain}`;
  }
  return `${local.slice(0, 2)}***${local.slice(-1)}@${domain}`;
}

/**
 * Strips ASCII and Unicode control characters (newlines, carriage returns, null bytes, tabs)
 * from single-line fields to prevent header injection, CRLF log pollution, and formatting breaks.
 */
export function sanitizeSingleLine(input: any): string {
  if (typeof input !== 'string') return '';
  return input.replace(/[\x00-\x1F\x7F]/g, '').trim();
}

/**
 * Strips harmful null bytes from multi-line text bodies while preserving standard whitespace.
 */
export function sanitizeMultiLine(input: any): string {
  if (typeof input !== 'string') return '';
  return input.replace(/\0/g, '').trim();
}

export interface ValidatedFormBody {
  cleanName: string;
  cleanEmail: string;
  cleanSubject: string;
  cleanMessage: string;
  cleanTopic: string;
}

/**
 * Backend Form Validation Middleware for /api/contact and /api/support.
 *
 * Implements:
 * 1. Payload structure and size guards.
 * 2. Honeypot (botcheck) rejection.
 * 3. Minimum form-completion time verification (>= 3 seconds).
 * 4. Duplicate submission detection within 60 seconds.
 * 5. String length constraints and control-character sanitization.
 * 6. Strict RFC 5322 email validation.
 */
export function validateFormSubmissionMiddleware(req: Request, res: Response, next: NextFunction): void {
  // 1. Guard against non-object payloads
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    res.status(400).json({ error: 'Malformed request: JSON object body required.' });
    return;
  }

  const { name, email, category, game, subject, message, botcheck, formStartedAt } = req.body;

  // 2. Honeypot check (botcheck)
  if (botcheck && typeof botcheck === 'string' && botcheck.trim().length > 0) {
    res.status(400).json({ error: 'Spam transmission rejected.' });
    return;
  }

  // 3. Minimum form-completion time verification
  if (formStartedAt !== undefined) {
    const started = Number(formStartedAt);
    if (isNaN(started)) {
      res.status(400).json({ error: 'Invalid submission timestamp.' });
      return;
    }
    const now = Date.now();
    const elapsed = now - started;

    // Check for clock skew / future timestamps (> 60 seconds in future)
    if (elapsed < -60000) {
      res.status(400).json({ error: 'Invalid submission timestamp. Please check your system clock.' });
      return;
    }

    // Check for expired form session (> 24 hours old)
    if (elapsed > 24 * 60 * 60 * 1000) {
      res.status(400).json({ error: 'Form session expired. Please refresh the page and try again.' });
      return;
    }

    // Reject submissions completed faster than 3 seconds (bot heuristic)
    if (elapsed < 3000) {
      res.status(400).json({
        error: 'Submission received too quickly. Please take at least 3 seconds to review your inquiry before sending.',
      });
      return;
    }
  }

  // 4. Sanitize and validate single-line text fields
  const cleanName = sanitizeSingleLine(name);
  const rawEmail = sanitizeSingleLine(email);
  const cleanSubject = sanitizeSingleLine(subject);
  const cleanCategory = sanitizeSingleLine(category);
  const cleanGame = sanitizeSingleLine(game);
  const cleanMessage = sanitizeMultiLine(message);

  if (!cleanName || cleanName.length < 2) {
    res.status(400).json({ error: 'Name is required and must be at least 2 characters.' });
    return;
  }
  if (cleanName.length > 100) {
    res.status(400).json({ error: 'Name cannot exceed 100 characters.' });
    return;
  }

  if (!rawEmail || rawEmail.length < 5) {
    res.status(400).json({ error: 'Valid email address is required.' });
    return;
  }
  if (rawEmail.length > 150) {
    res.status(400).json({ error: 'Email cannot exceed 150 characters.' });
    return;
  }
  const cleanEmail = rawEmail.toLowerCase();
  if (!STRICT_EMAIL_REGEX.test(cleanEmail)) {
    res.status(400).json({ error: 'Invalid email address format.' });
    return;
  }

  if (cleanSubject.length > 200) {
    res.status(400).json({ error: 'Subject cannot exceed 200 characters.' });
    return;
  }

  if (!cleanMessage || cleanMessage.length < 10) {
    res.status(400).json({ error: 'Message is required and must be at least 10 characters.' });
    return;
  }
  if (cleanMessage.length > 5000) {
    res.status(400).json({ error: 'Message exceeds the maximum limit of 5,000 characters.' });
    return;
  }

  const cleanTopic = (cleanCategory || cleanGame || cleanSubject || 'General Inquiry').slice(0, 100);

  // 5. Duplicate Submission Detection (within 60 seconds)
  const clientIp = req.ip || req.socket.remoteAddress || '127.0.0.1';
  const hashKey = crypto
    .createHash('sha256')
    .update(`${clientIp}:${cleanEmail}:${cleanSubject}:${cleanMessage}`)
    .digest('hex');

  const now = Date.now();
  const existingSubmission = duplicateSubmissions.get(hashKey);
  if (existingSubmission && now - existingSubmission.timestamp < 60 * 1000) {
    res.status(429).json({
      error: 'Duplicate submission detected. Please wait before resending the same transmission.',
    });
    return;
  }
  duplicateSubmissions.set(hashKey, { timestamp: now });

  // Attach sanitized data to request locals for endpoint consumption
  res.locals.validatedForm = {
    cleanName,
    cleanEmail,
    cleanSubject,
    cleanMessage,
    cleanTopic,
  } as ValidatedFormBody;

  next();
}

/**
 * Resets duplicate submission tracker (primarily for testing suites).
 */
export function resetDuplicateSubmissions(): void {
  duplicateSubmissions.clear();
}
