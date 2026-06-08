import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import { clerkMiddleware } from '@clerk/express';
import apiRouter from './routes';
import { errorHandler } from './middleware/errorHandler';

const app: Express = express();

// Security and utility middleware
app.use(helmet());
app.use(cors());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(compression());

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Apply Clerk authentication middleware before all routes
app.use(clerkMiddleware());

// Health Check route
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    timestamp: Date.now(),
  });
});

// API Routes
app.use('/api/v1', apiRouter);

// Global Error Handler (Must be registered last)
app.use(errorHandler);

export default app;
