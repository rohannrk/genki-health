import { getAuth } from '@clerk/express'
import { RequestHandler } from 'express'

export const requireAuth: RequestHandler = (req, res, next) => {
  const { userId } = getAuth(req)
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }
  req.clerkUserId = userId
  next()
}
