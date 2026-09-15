import { MiddlewareHandler } from 'hono';
import { Env } from '../types';

export const passcodeAuth: MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
  const passcode = c.env.PASSCODE;

  // In production, an unset PASSCODE is a critical misconfiguration
  if (!passcode || passcode.trim() === '') {
    if (c.env.ENVIRONMENT === 'production') {
      return c.json({
        success: false,
        error: 'Security Error: PASSCODE secret must be configured in production.'
      }, 503);
    }
    return next();
  }

  // Check header
  const reqPasscode = c.req.header('X-Passcode') ||
    c.req.header('Authorization')?.replace('Bearer ', '');

  if (!reqPasscode || reqPasscode !== passcode) {
    return c.json({
      success: false,
      error: 'Unauthorized: Invalid or missing passcode'
    }, 401);
  }

  return next();
};
