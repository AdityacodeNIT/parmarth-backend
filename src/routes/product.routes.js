import { Router } from "express";
import { upload } from "../middlewares/multer.middleware.js";
import {
        addProduct,
        getProducts,
        searchresult,
        deleteProduct,
        updateProduct,
        getSellerProduct,
        getTrendingProduct,
        getProductById,
} from "../controllers/product.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { verifyRole } from "../middlewares/role.middleware.js";

const router = Router();

router.route("/addProduct").post(
        verifyJWT,
        verifyRole(["seller", "superadmin"]),
        upload.fields([{ name: "productImage", maxCount: 1 },
    { name: "images", maxCount: 6 }]),
        addProduct,
);

router.route("/updateProduct/:id").post(
        verifyJWT,
        verifyRole(["seller", "superadmin"]),
        upload.single("productImage"),
        updateProduct,
);

router.route("/deleteProduct/:id").delete(
        verifyJWT,
        verifyRole(["seller", "superadmin"]),
        deleteProduct
    );

router.route("/manageProduct").get(verifyJWT,verifyRole(["seller","superadmin"]),getSellerProduct);


router.route("/").get(getProducts);
router.route("/getTrendingProduct").get(getTrendingProduct);

router.route("/:id").get(getProductById);




router.route("/searchProduct").post(searchresult);

export default router;
