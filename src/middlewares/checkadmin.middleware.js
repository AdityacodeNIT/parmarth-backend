import { ApiError } from "../utils/ApiError.js";

export const checkadmin = (req, res, next) => {
        const user = req.user;

        if (!user) {
                console.log("User not found in request, returning 401");
                return res
                        .status(401)
                        .json({ message: "Unauthorized: Please log in." });
        }

        if (user.isAdmin !== "true") {
                console.log("User is not an admin, returning 403");
                return res
                        .status(403)
                        .json({ message: "Forbidden: Admins only." });
        }

        console.log("Admin Access Granted:", user); // Log for debugging admin access

        next();
};
