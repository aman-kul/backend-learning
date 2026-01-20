import { Router } from "express";
import { changeCurrentPassword, getCurrentUser, getUserChannelProfile, getWatchHistory, refreshAccessToken, registerUser, updateAccountDetails, updateUserAvatar, updateUserCoverImage, userlogin, userLogout } from "../controllers/user.controller.js";
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
router.route("/change-password").post(verifiyJWT, changeCurrentPassword)
router.route("/change-user").get(verifiyJWT, getCurrentUser)
router.route("/update-account").patch(updateAccountDetails)
router.route("/avatar").patch(verifiyJWT, upload.single("avatar"), updateUserAvatar)
router.route("/cover-image").patch(verifiyJWT, upload.single("coverImage"), updateUserCoverImage)
router.route("/c/:username").get(verifiyJWT, getUserChannelProfile)
router.route("/history").get(verifiyJWT, getWatchHistory)

export default router;