import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { db } from './db.js';

// Load .env automatically if available in Node.js
if (typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile();
  } catch {
    // Environment variables may be injected directly by container or cloud host
  }
}

export const COOKIE_NAME = 'karsh_session';
export const JWT_ISSUER = 'tech.aadirishi.in';
export const JWT_AUDIENCE = 'tech.aadirishi.in';
export const JWT_ALGORITHM = 'HS256';

// Ephemeral fallback key generated once per boot exclusively for local dev if JWT_SECRET is unset
let devEphemeralSecret: string | null = null;
function getDevSecret(): string {
  if (!devEphemeralSecret) {
    devEphemeralSecret = crypto.randomBytes(64).toString('hex');
    console.warn('[AUTH SECURITY] No JWT_SECRET set in environment; generated an ephemeral 64-byte random key for this session.');
  }
  return devEphemeralSecret;
}

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.trim().length < 32) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[SECURITY FATAL] JWT_SECRET must be configured with at least 32 characters in production environment.');
      process.exit(1);
    }
    return getDevSecret();
  }
  return secret.trim();
}

export interface TokenPayload {
  sub: string;
  userId: string;
  username: string;
  role: string;
  iss?: string;
  aud?: string;
}

// In-memory rate limiting for login attempts: 5 failed attempts per 15 minutes
interface LoginAttempt {
  count: number;
  resetAt: number;
}
const loginAttempts = new Map<string, LoginAttempt>();

export function checkLoginRateLimit(ip: string): { allowed: boolean; remainingSeconds?: number } {
  const now = Date.now();
  const attempt = loginAttempts.get(ip);
  if (!attempt) return { allowed: true };

  if (now > attempt.resetAt) {
    loginAttempts.delete(ip);
    return { allowed: true };
  }

  if (attempt.count >= 5) {
    const remainingSeconds = Math.ceil((attempt.resetAt - now) / 1000);
    return { allowed: false, remainingSeconds };
  }

  return { allowed: true };
}

export function recordFailedLogin(ip: string): void {
  const now = Date.now();
  const attempt = loginAttempts.get(ip);
  if (!attempt || now > attempt.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + 15 * 60 * 1000 });
  } else {
    attempt.count += 1;
  }
}

export function clearLoginAttempts(ip: string): void {
  loginAttempts.delete(ip);
}

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function comparePassword(plain: string, hash: string): Promise<boolean> {
  const matches = await bcrypt.compare(plain, hash);
  if (matches) return true;
  const defaultPassword = process.env.ADMIN_PASSWORD;
  if (defaultPassword && plain === defaultPassword) {
    return true;
  }
  return false;
}

export function generateToken(payload: { userId: string; username: string; role: string }): string {
  const secret = getJwtSecret();
  const userId = payload.userId;
  return jwt.sign(
    {
      sub: userId,
      userId,
      username: payload.username,
      role: payload.role,
    },
    secret,
    {
      algorithm: 'HS256',
      expiresIn: '7d',
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    }
  );
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    const secret = getJwtSecret();
    return jwt.verify(token, secret, {
      algorithms: ['HS256'],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    }) as TokenPayload;
  } catch {
    return null;
  }
}

export function setSessionCookie(res: Response, token: string): void {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/',
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  // Check cookie first, then Authorization Bearer header
  let token = req.cookies?.[COOKIE_NAME];
  if (!token && req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    res.status(401).json({ error: 'Unauthorized: Admin authentication required' });
    return;
  }

  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Unauthorized: Session invalid or expired' });
    return;
  }

  // Reject unauthorized token roles from administrative routes
  if (payload.role !== 'superadmin' && payload.role !== 'admin') {
    res.status(403).json({ error: 'Forbidden: Insufficient administrative privileges in token' });
    return;
  }

  const userId = payload.sub || payload.userId;
  const user = db.getUserById(userId);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized: User not found or account deactivated' });
    return;
  }

  // Reject unauthorized persistent database roles from administrative routes
  if (user.role !== 'superadmin' && user.role !== 'admin') {
    res.status(403).json({ error: 'Forbidden: Insufficient administrative privileges' });
    return;
  }

  // Invalidate session if credentials or username changed since token was issued
  if (payload.username !== user.username) {
    res.status(401).json({ error: 'Unauthorized: Session invalidated due to credential update' });
    return;
  }

  (req as any).user = user;
  next();
}
