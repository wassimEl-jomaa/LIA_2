import "dotenv/config";
import express from "express";
import cors from "cors";
import { aiRouter } from "./routes/ai.js";

const app = express();
const PORT = process.env.PORT || 5050;

/* ================= Middleware ================= */
app.use(cors());
app.use(express.json({ limit: "1mb" }));

/* ================= Health check ================= */
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

/* ================= API routes ================= */
app.use("/api/ai", aiRouter);

/* ================= Start server ================= */
app.listen(PORT, () => {
  console.log(`✅ Backend running on http://localhost:${PORT}`);
});
