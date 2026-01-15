import mongoose from "mongoose";
import { DB_NAME } from "../constant.js";

const connect = async () => {
    try {
        const url = `${process.env.MONGODB_URL}/${DB_NAME}`
        console.log("connect", process.env.MONGODB_URL, DB_NAME)
        const connectionInstance = await mongoose.connect(url)
        console.log("MongoDB connected !! DB HOST :", connectionInstance.connection.host)
    } catch (error) {
        console.error("Connection Error :", error);
        process.exit(1)
    }
}

export default connect;