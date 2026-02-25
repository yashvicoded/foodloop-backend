import { Request, Response, NextFunction } from 'express';

export const validateProductInput = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { name, expiryDate, originalPrice, quantity } = req.body;
  const errors: string[] = [];

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    errors.push('Product name is required');
  }

  if (!expiryDate) {
    errors.push('Expiry date is required');
  } else {
    const date = new Date(expiryDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (date < today) {
      errors.push('Expiry date cannot be in the past');
    }
  }

  if (!originalPrice || originalPrice <= 0) {
    errors.push('Original price is required and must be > 0');
  }

  if (quantity && quantity < 1) {
    errors.push('Quantity must be at least 1');
  }

  if (errors.length > 0) {
    return res.status(400).json({ success: false, errors });
  }

  next();
};

export const validateDonationInput = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { productId, foodBankId, quantity } = req.body;
  const errors: string[] = [];

  if (!productId) errors.push('Product ID is required');
  if (!foodBankId) errors.push('Food Bank ID is required');
  if (quantity && quantity < 1) errors.push('Quantity must be >= 1');

  if (errors.length > 0) {
    return res.status(400).json({ success: false, errors });
  }

  next();
};