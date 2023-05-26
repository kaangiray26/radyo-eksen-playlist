import express from "express";
import Bree from 'bree';

// Express
const app = express()

// Scheduler
const bree = new Bree({
    jobs: [
        {
            name: 'run',
            cron: '*/5 7-10 * * *'
        }
    ]
});

app.get("/", (req, res) => {
    res.status(200).send("Service running!");
})

app.listen(process.env.PORT, '0.0.0.0', () => {
    bree.start();
})