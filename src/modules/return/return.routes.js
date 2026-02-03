import { Router } from 'express';
import {
  createReturnRequest,
  getMyReturns,
  getReturnById,
  approveReturn,
  rejectReturn,
  schedulePickup,
  updateReturnStatus,
  inspectReturn,
  initiateRefund,
  completeRefund,
  cancelReturn,
  getAllReturns,
  getReturnStats,
} from './return.controller.js';
import { verifyJWT } from '../../middlewares/auth.middleware.js';
import { checkadmin } from '../../middlewares/checkadmin.middleware.js';

const router = Router();

// Customer routes
router.post('/create', verifyJWT, createReturnRequest);
router.get('/my-returns', verifyJWT, getMyReturns);
router.get('/:id', verifyJWT, getReturnById);
router.post('/:id/cancel', verifyJWT, cancelReturn);

// Admin routes
router.get('/admin/all', verifyJWT, checkadmin, getAllReturns);
router.get('/admin/stats', verifyJWT, checkadmin, getReturnStats);
router.post('/:id/approve', verifyJWT, checkadmin, approveReturn);
router.post('/:id/reject', verifyJWT, checkadmin, rejectReturn);
router.post('/:id/schedule-pickup', verifyJWT, checkadmin, schedulePickup);
router.patch('/:id/status', verifyJWT, checkadmin, updateReturnStatus);
router.post('/:id/inspect', verifyJWT, checkadmin, inspectReturn);
router.post('/:id/refund', verifyJWT, checkadmin, initiateRefund);
router.post('/:id/refund/complete', verifyJWT, checkadmin, completeRefund);

export default router;
