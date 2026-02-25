import { AuthRequest } from '../middleware/auth';
import { Response } from 'express';
import { db } from '../config/firebase';
import { DiscountEngine, Product } from '../services/discountEngine';

export class AnalyticsController {
  /**
   * Get comprehensive analytics dashboard
   */
  static async getDashboard(req: AuthRequest, res: Response) {
    try {
      const storeId = req.user?.uid;

      if (!storeId) {
        return res.status(401).json({ 
          success: false,
          error: 'User not authenticated' 
        });
      }

      // Fetch products
      const productsSnapshot = await db
        .collection('products')
        .where('storeId', '==', storeId)
        .get();

      const products: Product[] = [];
      productsSnapshot.forEach(doc => {
        products.push({
          id: doc.id,
          ...doc.data(),
          expiryDate: doc.data().expiryDate.toDate(),
        } as Product);
      });

      // Fetch donations
      const donationsSnapshot = await db
        .collection('donations')
        .where('storeId', '==', storeId)
        .get();

      const donations: any[] = [];
      donationsSnapshot.forEach(doc => {
        donations.push({
          id: doc.id,
          ...doc.data(),
          donatedAt: doc.data().donatedAt.toDate(),
        });
      });

      // Calculate metrics
      const discountedProducts = DiscountEngine.batchCalculateDiscounts(products);
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const thisWeekDonations = donations.filter(d => d.donatedAt > weekAgo);

      const dashboard = {
        inventory: {
          total: products.length,
          discounted: discountedProducts.filter(p => p.discount.discountPercent > 0).length,
          urgent: discountedProducts.filter(p => p.discount.priority === 'URGENT').length,
          warning: discountedProducts.filter(p => p.discount.priority === 'WARNING').length,
          caution: discountedProducts.filter(p => p.discount.priority === 'CAUTION').length,
        },
        donations: {
          totalValue: donations.reduce((sum, d) => sum + d.donatedValue, 0),
          thisWeek: thisWeekDonations.length,
          thisWeekValue: thisWeekDonations.reduce((sum, d) => sum + d.donatedValue, 0),
          total: donations.length,
        },
        revenue: {
          recovered: DiscountEngine.estimateRevenueRecovery(discountedProducts),
          potential: DiscountEngine.estimateWaste(products),
        },
        freshness: {
          fresh: discountedProducts.filter(p => DiscountEngine.calculateDaysToExpiry(p.expiryDate) > 6).length,
          warning: discountedProducts.filter(p => DiscountEngine.calculateDaysToExpiry(p.expiryDate) > 2 && DiscountEngine.calculateDaysToExpiry(p.expiryDate) <= 6).length,
          urgent: discountedProducts.filter(p => DiscountEngine.calculateDaysToExpiry(p.expiryDate) <= 2).length,
        },
      };

      res.json({
        success: true,
        data: dashboard,
      });
    } catch (error) {
      console.error('Error fetching analytics:', error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to fetch analytics' 
      });
    }
  }

  /**
   * Get waste prevention report
   */
  static async getWasteReport(req: AuthRequest, res: Response) {
    try {
      const storeId = req.user?.uid;

      if (!storeId) {
        return res.status(401).json({ 
          success: false,
          error: 'User not authenticated' 
        });
      }

      const donationsSnapshot = await db
        .collection('donations')
        .where('storeId', '==', storeId)
        .get();

      const donations: any[] = [];
      donationsSnapshot.forEach(doc => {
        donations.push({
          id: doc.id,
          ...doc.data(),
          donatedAt: doc.data().donatedAt.toDate(),
        });
      });

      const report = {
        totalDonated: donations.length,
        totalValue: donations.reduce((sum, d) => sum + d.donatedValue, 0),
        averageValuePerDonation: donations.length > 0 
          ? donations.reduce((sum, d) => sum + d.donatedValue, 0) / donations.length 
          : 0,
        byWeek: this.groupDonationsByWeek(donations),
        trends: {
          thisWeek: donations.filter(d => {
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            return d.donatedAt > weekAgo;
          }).length,
          thisMonth: donations.filter(d => {
            const monthAgo = new Date();
            monthAgo.setMonth(monthAgo.getMonth() - 1);
            return d.donatedAt > monthAgo;
          }).length,
        },
      };

      res.json({
        success: true,
        data: report,
      });
    } catch (error) {
      console.error('Error fetching waste report:', error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to fetch waste report' 
      });
    }
  }

  /**
   * Get inventory trends (last 7 days)
   */
  static async getInventoryTrends(req: AuthRequest, res: Response) {
    try {
      const storeId = req.user?.uid;

      if (!storeId) {
        return res.status(401).json({ 
          success: false,
          error: 'User not authenticated' 
        });
      }

      const productsSnapshot = await db
        .collection('products')
        .where('storeId', '==', storeId)
        .get();

      const products: Product[] = [];
      productsSnapshot.forEach(doc => {
        products.push({
          id: doc.id,
          ...doc.data(),
          expiryDate: doc.data().expiryDate.toDate(),
        } as Product);
      });

      const discountedProducts = DiscountEngine.batchCalculateDiscounts(products);

      const trends = {
        daily: this.generateDailyTrends(products),
        categories: this.groupByCategory(discountedProducts),
        byDiscount: {
          noDiscount: discountedProducts.filter(p => p.discount.discountPercent === 0).length,
          discount25: discountedProducts.filter(p => p.discount.discountPercent >= 20 && p.discount.discountPercent < 40).length,
          discount50: discountedProducts.filter(p => p.discount.discountPercent >= 40 && p.discount.discountPercent < 70).length,
          discount75: discountedProducts.filter(p => p.discount.discountPercent >= 70).length,
        },
      };

      res.json({
        success: true,
        data: trends,
      });
    } catch (error) {
      console.error('Error fetching inventory trends:', error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to fetch inventory trends' 
      });
    }
  }

  /**
   * Group donations by week
   */
  private static groupDonationsByWeek(donations: any[]) {
    const weeks: { [key: string]: { count: number; value: number } } = {};

    donations.forEach(d => {
      const date = new Date(d.donatedAt);
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      const weekKey = weekStart.toISOString().split('T')[0];

      if (!weeks[weekKey]) {
        weeks[weekKey] = { count: 0, value: 0 };
      }

      weeks[weekKey].count++;
      weeks[weekKey].value += d.donatedValue;
    });

    return weeks;
  }

  /**
   * Generate daily trends for next 7 days
   */
  private static generateDailyTrends(products: Product[]) {
    const trends: { date: string; count: number; value: number }[] = [];

    for (let i = 0; i < 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];

      const productsExpiringToday = products.filter(p => {
        const expiry = new Date(p.expiryDate);
        expiry.setHours(0, 0, 0, 0);
        date.setHours(0, 0, 0, 0);
        return expiry.getTime() === date.getTime();
      });

      trends.push({
        date: dateStr,
        count: productsExpiringToday.length,
        value: productsExpiringToday.reduce((sum, p) => sum + p.originalPrice * p.quantity, 0),
      });
    }

    return trends;
  }

  /**
   * Group products by category with discount info
   */
  private static groupByCategory(products: any[]) {
    const categories: { [key: string]: { count: number; discounted: number; value: number; avgDiscount: number } } = {};

    products.forEach(p => {
      const cat = p.category || 'General';
      if (!categories[cat]) {
        categories[cat] = { count: 0, discounted: 0, value: 0, avgDiscount: 0 };
      }

      categories[cat].count++;
      categories[cat].value += p.originalPrice * p.quantity;

      if (p.discount.discountPercent > 0) {
        categories[cat].discounted++;
      }
    });

    // Calculate average discount
    Object.keys(categories).forEach(cat => {
      const discountedItems = products.filter(p => (p.category || 'General') === cat && p.discount.discountPercent > 0);
      if (discountedItems.length > 0) {
        categories[cat].avgDiscount = 
          discountedItems.reduce((sum, p) => sum + p.discount.discountPercent, 0) / discountedItems.length;
      }
    });

    return categories;
  }
}