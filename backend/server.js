import express from "express";
import dotenv from "dotenv";
dotenv.config();
import auhtRoutes from "./routes/auth.routes.js";
import messageRoutes from "./routes/message.routes.js";
import userRoutes from "./routes/user.routes.js";
import chatRequestRoutes from "./routes/chatRequest.routes.js";
import blockRoutes from "./routes/block.routes.js";
import connectToMongoDB from "./db/connectToMongoDB.js";
import cookieParser from "cookie-parser";
import { app,server } from "./socket/socket.js";
import path from 'path';

const port = process.env.PORT || 5001;

const __dirname=path.resolve();

app.use(express.json());
app.use(cookieParser());

app.use("/api/auth", auhtRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/users", userRoutes);
app.use("/api/chat-requests", chatRequestRoutes);
app.use("/api/block", blockRoutes);

app.use(express.static(path.join(__dirname,"/frontend/dist")))

app.get("*",(req,res)=>{
  res.sendFile(path.join(__dirname,"frontend","dist","index.html"))
})

server.listen(port, () => {
  connectToMongoDB();
  console.log(`server running on port ${port}`);
});
