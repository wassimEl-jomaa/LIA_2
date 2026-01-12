import "dotenv/config";
import express from "express";
import cors from "cors";
import { aiRouter } from "./routes/ai.js";

const app = express();

app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/health", (req, res) => res.json({ ok: true }));

app.use("/api/ai", aiRouter);

const port = process.env.PORT || 5050;
app.listen(port, () => {
  console.log(`Backend running on http://localhost:${port}`);
});
