import type { NextFunction, Request, RequestHandler, Response } from 'express'

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public extra?: Record<string, unknown>,
  ) {
    super(message)
  }
}

/** Express 4 does not catch rejected promises, so every async route goes through this. */
export const h =
  (fn: (req: Request, res: Response) => Promise<unknown>): RequestHandler =>
  (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch(next)
  }
