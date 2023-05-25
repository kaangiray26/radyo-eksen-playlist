import express from "express";
import { Service } from "./service.js";

// Express
const app = express()
const service = new Service();

app.get("/", (req, res) => {
    res.status(200).send("Service running!");
})

app.listen(process.env.PORT, '0.0.0.0', () => {
    service.init();
})