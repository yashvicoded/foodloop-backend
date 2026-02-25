import { Response } from 'express';
import { db } from '../config/firebase';
import { AuthRequest } from '../middleware/auth';

export class DonationController {
  // 1. Record a Donation
  static async recordDonation(req: AuthRequest, res: Response) {
    try {
      const donation = {
        ...req.body,
        storeId: req.user?.uid,
        status: 'PENDING',
        createdAt: new Date(),
      };
      const docRef = await db.collection('donations').add(donation);
      res.status(201).json({ success: true, id: docRef.id });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // 2. Get Donation History
  static async getDonationHistory(req: AuthRequest, res: Response) {
    try {
      const snapshot = await db.collection('donations')
        .where('storeId', '==', req.user?.uid)
        .orderBy('createdAt', 'desc')
        .get();
      const donations = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      res.json({ success: true, data: donations });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // 3. Update Donation Status
  static async updateDonationStatus(req: AuthRequest, res: Response) {
    try {
      const { donationId } = req.params;
      const { status } = req.body;

      // The "as string" fix for lines 151 and 176
      const id = donationId as string;

      await db.collection('donations').doc(id).update({
        status,
        updatedAt: new Date()
      });

      res.json({ success: true, message: 'Status updated' });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
}