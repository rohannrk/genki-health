import { env } from './env';
import app from './app';

const server = app.listen(env.PORT, () => {
  console.log(`🚀 Server running in [${env.NODE_ENV}] mode on port ${env.PORT}`);
});

// Handle graceful shutdown
const gracefulShutdown = () => {
  console.log('Received kill signal, shutting down gracefully...');
  server.close(() => {
    console.log('Closed out remaining connections.');
    process.exit(0);
  });

  setTimeout(() => {
    console.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
