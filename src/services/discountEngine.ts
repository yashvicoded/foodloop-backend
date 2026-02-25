export interface Product {
  id: string;
  storeId: string;
  name: string;
  category: string;
  expiryDate: Date;
  originalPrice: number;
  currentPrice: number;
  isDiscounted: boolean;
  quantity: number;
  lastUpdated: Date;
}

export interface DiscountResult {
  discountPercent: number;
  finalPrice: number;
  priority: string;
  reason: string;
}

export class DiscountEngine {
  private static readonly DISCOUNT_RULES = [
    { daysToExpiry: 2, discountPercent: 75, priority: 'URGENT' },
    { daysToExpiry: 4, discountPercent: 50, priority: 'WARNING' },
    { daysToExpiry: 6, discountPercent: 25, priority: 'CAUTION' },
  ];

  private static readonly CATEGORY_MULTIPLIERS: { [key: string]: number } = {
    'Bakery': 1.2,
    'Dairy': 1.1,
    'Fresh Produce': 1.15,
    'Frozen': 0.8,
    'Canned': 0.5,
  };

  static calculateDaysToExpiry(expiryDate: Date): number {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiry = new Date(expiryDate);
    expiry.setHours(0, 0, 0, 0);
    const diffTime = expiry.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  static calculateDiscount(product: Product): DiscountResult {
    const daysLeft = this.calculateDaysToExpiry(product.expiryDate);
    let rule = this.DISCOUNT_RULES.find(r => daysLeft <= r.daysToExpiry);
    
    if (!rule) {
      return {
        discountPercent: 0,
        finalPrice: product.originalPrice,
        priority: 'NORMAL',
        reason: 'Item is fresh',
      };
    }

    const categoryMultiplier = this.CATEGORY_MULTIPLIERS[product.category] || 1.0;
    let finalDiscount = rule.discountPercent * categoryMultiplier;
    finalDiscount = Math.min(finalDiscount, 95);

    const minPrice = product.originalPrice * 0.1;
    const finalPrice = Math.max(
      product.originalPrice * (1 - finalDiscount / 100),
      minPrice
    );

    return {
      discountPercent: Math.round(finalDiscount),
      finalPrice: parseFloat(finalPrice.toFixed(2)),
      priority: rule.priority,
      reason: `Expiring in ${daysLeft} day${daysLeft !== 1 ? 's' : ''} (${product.category})`,
    };
  }

  static batchCalculateDiscounts(products: Product[]): (Product & { discount: DiscountResult })[] {
    return products.map(product => ({
      ...product,
      discount: this.calculateDiscount(product),
    }));
  }

  static sortByPriority(products: (Product & { discount: DiscountResult })[]): typeof products {
    const priorityOrder = { 'URGENT': 0, 'WARNING': 1, 'CAUTION': 2, 'NORMAL': 3 };
    
    return products.sort((a, b) => {
      const priorityA = priorityOrder[a.discount.priority as keyof typeof priorityOrder] || 999;
      const priorityB = priorityOrder[b.discount.priority as keyof typeof priorityOrder] || 999;
      
      if (priorityA !== priorityB) return priorityA - priorityB;
      return a.expiryDate.getTime() - b.expiryDate.getTime();
    });
  }

  static estimateRevenueRecovery(products: (Product & { discount: DiscountResult })[]): number {
    return products.reduce((sum, p) => {
      if (p.discount.discountPercent > 0) {
        return sum + (p.discount.finalPrice * p.quantity);
      }
      return sum;
    }, 0);
  }

  static estimateWaste(products: Product[]): number {
    const urgentProducts = products.filter(p => 
      this.calculateDaysToExpiry(p.expiryDate) <= 2
    );
    return urgentProducts.reduce((sum, p) => sum + p.originalPrice * p.quantity, 0);
  }
}