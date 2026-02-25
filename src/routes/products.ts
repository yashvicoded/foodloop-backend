import { Router } from 'express';
// Use './' or '../' to tell the code where to look relative to this file
import { ProductController } from '../controllers/productController';
import { validateProductInput } from '../middleware/validation';

const router = Router();

router.post('/', validateProductInput, ProductController.addProduct);
router.get('/', ProductController.getProducts);
router.get('/urgent', ProductController.getUrgentProducts);
router.patch('/:productId', ProductController.updateProduct);
router.delete('/:productId', ProductController.deleteProduct);

export default router;