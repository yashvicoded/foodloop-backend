import { AuthRequest } from '../middleware/auth';
import { Response } from 'express';
import { db } from '../config/firebase';
import { DiscountEngine, Product } from '../services/discountEngine';

export class DiscountController {
  /**
   * Calculate discounts for all products
   */
  static async calculateDiscounts(req: AuthRequest, res: Response) {
    try {
      const storeId = req.user?.uid;

      if (!storeId) {
        return res.status(401).json({ 
          success: false,
          error: 'User not authenticated' 
        });
      }

      // Fetch all products
      const snapshot = await db
        .collection('products')
        .where('storeId', '==', storeId)
        .get();

      const products: Product[] = [];
      snapshot.forEach(doc => {
        products.push({
          id: doc.id,
          ...doc.data(),
          expiryDate: doc.data().expiryDate.toDate(),
        } as Product);
      });

      // Calculate discounts
      const productsWithDiscounts = DiscountEngine.batchCalculateDiscounts(products);
      const sortedProducts = DiscountEngine.sortByPriority(productsWithDiscounts);

      // Separate products by discount level
      const categorized = {
        urgent: sortedProducts.filter(p => p.discount.priority === 'URGENT'),
        warning: sortedProducts.filter(p => p.discount.priority === 'WARNING'),
        caution: sortedProducts.filter(p => p.discount.priority === 'CAUTION'),
        normal: sortedProducts.filter(p => p.discount.priority === 'NORMAL'),
      };

      res.json({
        success: true,
        message: 'Discounts calculated successfully',
        data: {
          totalProducts: products.length,
          breakdown: {
            urgent: categorized.urgent.length,
            warning: categorized.warning.length,
            caution: categorized.caution.length,
            normal: categorized.normal.length,
          },
          estimatedRevenue: DiscountEngine.estimateRevenueRecovery(sortedProducts),
          estimatedWaste: DiscountEngine.estimateWaste(products),
          topUrgentItems: categorized.urgent.slice(0, 5).map(p => ({
            id: p.id,
            name: p.name,
            category: p.category,
            daysLeft: DiscountEngine.calculateDaysToExpiry(p.expiryDate),
            originalPrice: p.originalPrice,
            discountedPrice: p.discount.finalPrice,
            discount: p.discount.discountPercent,
            quantity: p.quantity,
            reason: p.discount.reason,
          })),
        },
      });
    } catch (error) {
      console.error('Error calculating discounts:', error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to calculate discounts' 
      });
    }
  }

  /**
   * Apply calculated discounts to database
   */
  static async applyDiscounts(req: AuthRequest, res: Response) {
    try {
      const storeId = req.user?.uid;

      if (!storeId) {
        return res.status(401).json({ 
          success: false,
          error: 'User not authenticated' 
        });
      }

      // Fetch all products
      const snapshot = await db
        .collection('products')
        .where('storeId', '==', storeId)
        .get();

      const products: Product[] = [];
      snapshot.forEach(doc => {
        products.push({
          id: doc.id,
          ...doc.data(),
          expiryDate: doc.data().expiryDate.toDate(),
        } as Product);
      });

      // Calculate discounts
      const productsWithDiscounts = DiscountEngine.batchCalculateDiscounts(products);

      // Apply to database using batch
      const batch = db.batch();
      let appliedCount = 0;

      productsWithDiscounts.forEach(product => {
        if (product.discount.discountPercent > 0) {
          const docRef = db.collection('products').doc(product.id);
          batch.update(docRef, {
            currentPrice: product.discount.finalPrice,
            isDiscounted: true,
            discountPercent: product.discount.discountPercent,
            lastUpdated: new Date(),
          });
          appliedCount++;
        }
      });

      // Commit batch
      await batch.commit();

      res.json({
        success: true,
        message: `Discounts applied to ${appliedCount} products`,
        appliedCount,
        data: {
          appliedCount,
          remainingProducts: products.length - appliedCount,
        },
      });
    } catch (error) {
      console.error('Error applying discounts:', error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to apply discounts' 
      });
    }
  }

  /**
   * Get discount summary
   */
  static async getDiscountSummary(req: AuthRequest, res: Response) {
    try {
      const storeId = req.user?.uid;

      if (!storeId) {
        return res.status(401).json({ 
          success: false,
          error: 'User not authenticated' 
        });
      }

      const snapshot = await db
        .collection('products')
        .where('storeId', '==', storeId)
        .get();

      const products: Product[] = [];
      snapshot.forEach(doc => {
        products.push({
          id: doc.id,
          ...doc.data(),
          expiryDate: doc.data().expiryDate.toDate(),
        } as Product);
      });

      const discountedProducts = DiscountEngine.batchCalculateDiscounts(products);
      const sortedProducts = DiscountEngine.sortByPriority(discountedProducts);

      const summary = {
        totalProducts: products.length,
        urgentItems: sortedProducts.filter(p => p.discount.priority === 'URGENT').length,
        warningItems: sortedProducts.filter(p => p.discount.priority === 'WARNING').length,
        cautionItems: sortedProducts.filter(p => p.discount.priority === 'CAUTION').length,
        normalItems: sortedProducts.filter(p => p.discount.priority === 'NORMAL').length,
        totalDiscountValue: discountedProducts.reduce(
          (sum, p) => sum + ((p.originalPrice - p.discount.finalPrice) * p.quantity),
          0
        ),
        estimatedRevenue: DiscountEngine.estimateRevenueRecovery(sortedProducts),
        estimatedWaste: DiscountEngine.estimateWaste(products),
        percentageDiscounted: products.length > 0 
          ? Math.round((discountedProducts.filter(p => p.discount.discountPercent > 0).length / products.length) * 100)
          : 0,
      };

      res.json({
        success: true,
        data: summary,
      });
    } catch (error) {
      console.error('Error fetching discount summary:', error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to fetch summary' 
      });
    }
  }
}