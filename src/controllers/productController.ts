import { Response } from 'express';
import { db } from '../config/firebase';
import { AuthRequest } from '../middleware/auth';

export class ProductController {
  // 1. ADD PRODUCT
  static async addProduct(req: AuthRequest, res: Response) {
    try {
      const product = {
        ...req.body,
        storeId: req.user?.uid,
        createdAt: new Date(),
      };
      const docRef = await db.collection('products').add(product);
      res.status(201).json({ success: true, id: docRef.id });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // 2. GET ALL PRODUCTS
  static async getProducts(req: AuthRequest, res: Response) {
    try {
      const snapshot = await db.collection('products')
        .where('storeId', '==', req.user?.uid)
        .get();
      const products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      res.json({ success: true, data: products });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // 3. UPDATE PRODUCT
  static async updateProduct(req: AuthRequest, res: Response) {
    try {
      const { productId } = req.params;
      const storeId = req.user?.uid;
      const updateData = req.body;

      if (!storeId) {
        return res.status(401).json({ success: false, error: 'User not authenticated' });
      }

      const doc = await db.collection('products').doc(productId as string).get();

      if (!doc.exists) {
        return res.status(404).json({ success: false, error: 'Product not found' });
      }

      if (doc.data()?.storeId !== storeId) {
        return res.status(403).json({ success: false, error: 'Unauthorized' });
      }

      updateData.lastUpdated = new Date();
      await db.collection('products').doc(productId as string).update(updateData);

      res.json({ 
        success: true, 
        message: 'Product updated successfully',
        data: { id: productId, ...updateData }
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // 4. DELETE PRODUCT
  static async deleteProduct(req: AuthRequest, res: Response) {
    try {
      const { productId } = req.params;
      await db.collection('products').doc(productId as string).delete();
      res.json({ success: true, message: 'Deleted successfully' });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // 5. URGENT PRODUCTS
  static async getUrgentProducts(req: AuthRequest, res: Response) {
    res.json({ success: true, data: [], message: "Urgent products logic ready" });
  }
}