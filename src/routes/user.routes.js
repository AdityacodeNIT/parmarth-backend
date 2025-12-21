import { Router } from "express";
import {
  logOutUser,
  loginUser,
  refreshAccessToken,
  registerUser,
  updateAccountdetail,
  updateUserAvatar,
  changePassword,
} from "../controllers/user.controller.js";

import {
  updateUserRole,
  userlist,
  deleteUser,
  getAllSellers,
  getSellerById,
  updateSellerApproval,
  deleteSeller,
} from "../controllers/admin.controllers.js";

import { verifyRole } from "../middlewares/role.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";
import { isAuthenticated, verifyJWT } from "../middlewares/auth.middleware.js";
import { validateRegister } from "../middlewares/validation.middleware.js";

const router = Router();

// ─────────────────────────────── USER ROUTES ───────────────────────────────

// ✅ Register user
router.route("/register").post(
  upload.fields([
    { name: "avatar", maxCount: 1 },
    { name: "coverImage", maxCount: 1 },
  ]),
  validateRegister,
  isAuthenticated,
  registerUser
);

// ✅ Login user
router.route("/login").post(isAuthenticated, loginUser);

// ✅ Logout
router.route("/logout").post(verifyJWT, logOutUser);

// ✅ Refresh token
router.route("/refresh-token").post(refreshAccessToken);

// ✅ Update avatar
router.route("/updateAvatar").post(upload.single("avatar"), verifyJWT, updateUserAvatar);

// ✅ Update user details
router.route("/updateUserdetail").post(verifyJWT, updateAccountdetail);

// ✅ Change password
router.route("/changePassword").post(verifyJWT, changePassword);


// ─────────────────────────────── ADMIN ROUTES ───────────────────────────────

// ✅ Get all users
router.route("/userList").get(verifyJWT, verifyRole("superadmin"), userlist);

// ✅ Delete a user
router
  .route("/deleteUser/:id")
  .delete(verifyJWT, verifyRole("superadmin"), deleteUser);

// ✅ Update a user’s role
router
  .route("/updateUserPost/:id")
  .post(verifyJWT, verifyRole("superadmin"), updateUserRole);


// ─────────────────────────────── SELLER MANAGEMENT ───────────────────────────────
// ✅ Get all sellers (optional query: ?status=pending or ?status=approved)
router
  .route("/sellers")
  .get(verifyJWT, verifyRole("superadmin"), getAllSellers);

// ✅ Get single seller details by ID
router
  .route("/sellers/:id")
  .get(verifyJWT, verifyRole("superadmin"), getSellerById);

// ✅ Approve / revoke seller
router
  .route("/sellers/:id")
  .patch(verifyJWT, verifyRole("superadmin"), updateSellerApproval);

// ✅ Delete seller
router
  .route("/sellers/:id")
  .delete(verifyJWT, verifyRole("superadmin"), deleteSeller);


// ─────────────────────────────── EXPORT ROUTER ───────────────────────────────
export default router;
