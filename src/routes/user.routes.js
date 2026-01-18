import { Router } from "express";
import { refreshAccessToken, registerUser, userlogin, userLogout } from "../controllers/user.controller.js";
import { upload } from '../middlewares/multer.middleware.js'
import { verifiyJWT } from "../middlewares/auth.middleware.js";
const router = Router();


router.route("/register").post(
    upload.fields([
        {
            name: "avatar",
            maxCount: 1
        },
        {
            name: "coverImage",
            maxCount: 1
        }
    ]),
    registerUser
);

router.route("/login").post(userlogin);

router.route("/logout").post(verifiyJWT, userLogout);
router.route("/refresh-token").post(refreshAccessToken)

export default router;