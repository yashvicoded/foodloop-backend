
import { Router } from 'express';
import { AnalyticsController } from '../controllers/analyticsController';

const router = Router();

router.get('/dashboard', AnalyticsController.getDashboard);
router.get('/waste-report', AnalyticsController.getWasteReport);

export default router;
