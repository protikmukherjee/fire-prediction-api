/**
 * firebase_fire_alert_loop.js
 *
 * Polls your entire SmartHomeSystem node every minute, posts it to your combined
 * Fire/Occupancy/Power inference endpoint (fire_api.py) on Render, and writes back:
 *  • raw predictions under Alerts/Latest
 *  • human-readable recommendation under Alerts/Alert1
 */

const admin = require("firebase-admin");
const axios = require("axios");
const serviceAccount = require("./serviceAccountKey.json");

// --- Initialize Firebase Admin SDK ---
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://smart-fire-system-684fb-default-rtdb.firebaseio.com"
});

const db        = admin.database();
const rootRef   = db.ref("SmartHomeSystem");
const alertsRef = db.ref("SmartHomeSystem/Alerts");

// --- Poll & Predict ---
async function runPredictionCheck() {
  try {
    // 1) Read full system snapshot
    const snap = await rootRef.once("value");
    const data = snap.val();
    if (!data) {
      console.warn("⚠️  No data at SmartHomeSystem");
      return;
    }

    // 2) Call your combined inference API on Render
    const res = await axios.post(
      "https://fire-prediction-api.onrender.com/predict",
      data,
      { timeout: 15000 }
    );
    const {
      fire_probability,
      occupancy_probability,
      power_prediction,
      recommendation
    } = res.data;

    // 3) Format timestamp
    const now       = new Date();
    const timestamp = now.toISOString().replace("T", " ").split(".")[0];

    // 4) Write raw predictions under Alerts/Latest
    await alertsRef.child("Latest").set({
      timestamp,
      fire_probability,
      occupancy_probability,
      power_prediction,
      recommendation
    });

    // 5) Write the human-readable recommendation under Alerts/Alert1
    const message = `${timestamp} / ${recommendation}`;
    await alertsRef.child("Alert1").set(message);

    console.log(`✅ Alert1 updated: ${message}`);

  } catch (err) {
    console.error("❌ Prediction failed:", err.message || err);
  }
}

// Run immediately, then every 60 seconds
runPredictionCheck();
setInterval(runPredictionCheck, 60 * 1000);
