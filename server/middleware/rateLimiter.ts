import type { Request, Response, NextFunction } from 'express';

export interface RateLimiterOptions {
  windowMs: number;
  max: number;
  name: string;
  message?: string;
  keyGenerator?: (req: Request) => string;
}

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

/**
 * In-Memory Sliding-Window Rate Limiter
 *
 * NOTE: Rate limits are process-local and in-memory. They reset upon server restart.
 * If horizontal scaling (multi-instance) is introduced in the future, this should
 * be backed by a shared Redis or database store.
 */
export class MemoryRateLimiter {
  private store = new Map<string, RateLimitRecord>();
  private readonly windowMs: number;
  private readonly max: number;
  private readonly name: string;
  private readonly message: string;
  private readonly keyGenerator: (req: Request) => string;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(options: RateLimiterOptions) {
    this.windowMs = options.windowMs;
    this.max = options.max;
    this.name = options.name;
    this.message =
      options.message ||
      `Too many requests to ${this.name}. Please wait before retrying.`;
    this.keyGenerator =
      options.keyGenerator ||
      ((req: Request) => req.ip || req.socket.remoteAddress || '127.0.0.1');

    // Run periodic cleanup every 5 minutes (unref so tests exit cleanly)
    this.cleanupInterval = setInterval(() => this.pruneStale(), 5 * 60 * 1000);
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  private pruneStale(): void {
    const now = Date.now();
    for (const [key, record] of this.store.entries()) {
      if (now > record.resetAt) {
        this.store.delete(key);
      }
    }
  }

  public middleware() {
    return (req: Request, res: Response, next: NextFunction): void => {
      const now = Date.now();
      const key = this.keyGenerator(req);
      let record = this.store.get(key);

      if (!record || now > record.resetAt) {
        record = {
          count: 1,
          resetAt: now + this.windowMs,
        };
        this.store.set(key, record);
      } else {
        record.count += 1;
      }

      const remaining = Math.max(0, this.max - record.count);
      const resetSeconds = Math.ceil((record.resetAt - now) / 1000);

      res.setHeader('RateLimit-Limit', this.max.toString());
      res.setHeader('RateLimit-Remaining', remaining.toString());
      res.setHeader('RateLimit-Reset', Math.ceil(record.resetAt / 1000).toString());

      if (record.count > this.max) {
        res.setHeader('Retry-After', resetSeconds.toString());
        res.status(429).json({
          error: 'Rate limit exceeded.',
          message: this.message,
          retryAfter: resetSeconds,
        });
        return;
      }

      next();
    };
  }

  public reset(): void {
    this.store.clear();
  }

  public destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.store.clear();
  }
}

// -----------------------------------------------------------------------------
// PRE-CONFIGURED LIMITERS AS PER PHASE 3 SPECIFICATION
// -----------------------------------------------------------------------------

// Contact: 5 submissions per IP per 15 minutes
export const contactLimiterInstance = new MemoryRateLimiter({
  name: 'Contact Submissions',
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many contact inquiries from this IP address. Please wait 15 minutes before sending another inquiry.',
});
export const contactRateLimiter = contactLimiterInstance.middleware();

// Support: 5 submissions per IP per 15 minutes
export const supportLimiterInstance = new MemoryRateLimiter({
  name: 'Support Tickets',
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many support ticket submissions from this IP address. Please wait 15 minutes before submitting another ticket.',
});
export const supportRateLimiter = supportLimiterInstance.middleware();

// Configuration: 30 requests per IP per 15 minutes
export const configLimiterInstance = new MemoryRateLimiter({
  name: 'Form Configuration',
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: 'Too many configuration queries from this IP address. Please wait before retrying.',
});
export const configRateLimiter = configLimiterInstance.middleware();

/**
 * Resets all form-related rate limiters (primarily for testing suites).
 */
export function resetAllFormRateLimits(): void {
  contactLimiterInstance.reset();
  supportLimiterInstance.reset();
  configLimiterInstance.reset();
}
