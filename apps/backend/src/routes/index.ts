import { Router } from 'express';
import authRouter from './auth';
import documentsRouter from './documents';
import biomarkersRouter from './biomarkers';
import aiRouter from './ai';
import keysRouter from './keys';
import auditRouter from './audit';
import consentRouter from './consent';
import accountRouter from './account';
import sharesRouter from './shares';
import publicShareRouter from './publicShare';

const router = Router();

// Public (unauthenticated) routes — must be registered before auth-gated routers.
router.use('/share', publicShareRouter);

// Register routers
router.use('/auth', authRouter);
router.use('/documents', documentsRouter);
router.use('/biomarkers', biomarkersRouter);
router.use('/ai', aiRouter);
router.use('/keys', keysRouter);
router.use('/audit', auditRouter);
router.use('/consent', consentRouter);
router.use('/account', accountRouter);
router.use('/shares', sharesRouter);

export default router;
