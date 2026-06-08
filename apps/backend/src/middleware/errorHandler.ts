import { Request, Response, NextFunction } from 'express';
import { env } from '../env';

/**
 * Express global unhandled error interceptor.
 * Formats errors uniformly as JSON responses.
 */
export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // If headers have already been sent to client, delegate to default Express handler
  if (res.headersSent) {
    return next(err);
  }

  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  const message = err.message || 'Internal Server Error';

  console.error(`💥 [ERROR] ${req.method} ${req.url} - ${message}`);
  if (err.stack) {
    console.error(err.stack);
  }

  res.status(statusCode).json({
    status: 'error',
    message,
    stack: env.NODE_ENV === 'production' ? undefined : err.stack,
  });
};
