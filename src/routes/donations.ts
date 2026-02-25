import { Router } from 'express';
import { DonationController } from '../controllers/donationController';
import { validateDonationInput } from '../middleware/validation';

const router = Router();

router.post('/', validateDonationInput, DonationController.recordDonation);
router.get('/history', DonationController.getDonationHistory);
router.patch('/:donationId/status', DonationController.updateDonationStatus);

export default router;
