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

app.listen(process.env.PORT, '0.0.0.0', () => {
    service.init();
})