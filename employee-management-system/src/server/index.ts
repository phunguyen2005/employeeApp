import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import * as trpcExpress from '@trpc/server/adapters/express';
import { appRouter } from './routers/appRouter';
import { createContext } from './context';

const app = express();

// Cross-Origin configuration
app.use(cors({
  origin: process.env.VITE_APP_URL || 'http://localhost:3000',
  credentials: true,
}));

app.use(cookieParser());

// Provide the tRPC endpoint
app.use(
  '/trpc',
  trpcExpress.createExpressMiddleware({
    router: appRouter,
    createContext,
  })
);

const port = process.env.PORT || 4000;

app.listen(port, () => {
  console.log(`Backend server listening at http://localhost:${port}`);
});
