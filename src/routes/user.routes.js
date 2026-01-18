import { Router } from "express";
import { registerUser, userlogin, userLogout } from "../controllers/user.controller.js";
import { upload } from '../middlewares/multer.middleware.js'
import { verifiyJWT } from "../middlewares/auth.middleware.js";
const route = Router();


route.route("/register").post(
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

route.route("/login").post(userlogin);

route.route("/logout").post(verifiyJWT, userLogout);

export default route;