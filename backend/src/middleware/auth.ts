import { MiddlewareHandler } from 'hono';
import { Env } from '../types';

export const passcodeAuth: MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
  const passcode = c.env.PASSCODE;

  // If no passcode is set in environment secrets, allow access
  if (!passcode || passcode.trim() === '') {
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
