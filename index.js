import express from "express";
import { Service } from "./service.js";

// Express
const app = express()
const service = new Service();

app.get("/", (req, res) => {
    res.status(200).send("Service running!");
})

app.get("/auth", (req, res) => {
    // Get code URL parameters
    service.getAccessToken(req.query.code).then(() => {
        res.status(200).send("<p>Authorization successful!<br>You can now close this window.</p>");
    })
})

app.listen(3000, '0.0.0.0', () => {
    console.log("Server running on:", "\x1b[32mhttp://localhost:3000/\x1b[0m");
    service.init();
})