
import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import * as dotenv from 'dotenv';

import productRoutes from './routes/products';
import discountRoutes from './routes/discounts';
import donationRoutes from './routes/donations';
import analyticsRoutes from './routes/analytics';

import { errorHandler } from './middleware/errorHandler';
import { verifyToken } from './middleware/auth';
import { env } from './config/env';

dotenv.config();

const app: Express = express();

app.use(cors({
  origin: env.REACT_APP_URL,
  credentials: true,
}));
app.use(bodyParser.json({ limit: '10kb' }));
app.use(bodyParser.urlencoded({ limit: '10kb', extended: true }));

app.get('/health', (req: Request, res: Response) => {
  res.json({ 
    status: 'Server is running',
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
  });
});

app.use('/api/products', verifyToken, productRoutes);
app.use('/api/discounts', verifyToken, discountRoutes);
app.use('/api/donations', verifyToken, donationRoutes);
app.use('/api/analytics', verifyToken, analyticsRoutes);

app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    path: req.path,
  });
});

app.use(errorHandler);

const PORT = env.PORT;
app.listen(PORT, () => {
  console.log(`✅ FoodLoop Backend running on port ${PORT}`);
  console.log(`🔗 API: http://localhost:${PORT}/api`);
  console.log(`📊 Health: http://localhost:${PORT}/health`);
});

export default app;
