import { Router } from 'express';
import authRouter from './auth';
import profilesRouter from './profiles';
import documentsRouter from './documents';
import aiRouter from './ai';
import keysRouter from './keys';

const router = Router();

// Register routers
router.use('/auth', authRouter);
router.use('/profiles', profilesRouter);
router.use('/documents', documentsRouter);
router.use('/ai', aiRouter);
router.use('/keys', keysRouter);

export default router;
