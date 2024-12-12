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
import { upload } from "../middlewares/multer.middleware.js";

import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router.route("/register").post(
        upload.fields([
                {
                        name: "avatar",
                        maxCount: 1,
                },
                {
                        name: "coverImage",
                        maxCount: 1,
                },
        ]),
        registerUser,
);

router.route("/login").post(loginUser);

router.route("/logout").post(verifyJWT, logOutUser);

router.route("/updateAvatar").post(upload.single("avatar"), updateUserAvatar);
router.route("/updateUserdetail").post(verifyJWT, updateAccountdetail);
router.route("/changePassword").post(verifyJWT, changePassword);
// Secured Routes

router.route("/refresh-token").post(verifyJWT, refreshAccessToken);
export default router;
