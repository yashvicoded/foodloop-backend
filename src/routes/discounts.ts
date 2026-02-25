import { Router } from 'express';
import { DiscountController } from '../controllers/discountController';

const router = Router();

router.post('/calculate', DiscountController.calculateDiscounts);
router.post('/apply', DiscountController.applyDiscounts);
router.get('/summary', DiscountController.getDiscountSummary);

export default router;

