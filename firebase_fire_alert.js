const admin = require("firebase-admin");
const axios = require("axios");
const serviceAccount = require("./serviceAccountKey.json");

// Initialize Firebase
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://smart-fire-system-684fb-default-rtdb.firebaseio.com"
});

const db = admin.database();
const fireRef = db.ref("SmartHomeSystem/SmartFireSystem");
const alertsRef = db.ref("SmartHomeSystem/Alerts");

// Run fire prediction and update Alert1
async function runPredictionCheck() {
  try {
    const snapshot = await fireRef.once("value");
    const data = snapshot.val();

    if (!data) {
      console.warn("⚠️ No data found in SmartFireSystem");
      return;
    }

    const response = await axios.post("https://fire-prediction-api.onrender.com/predict", data);
    const { probability, status } = response.data;

    if (typeof probability !== "number") {
      throw new Error("⚠️ Received invalid probability from prediction API");
    }

    const now = new Date();
    const timeStr = now.toISOString().replace("T", " ").split(".")[0];
    const riskLevel = probability > 0.4 ? "High" : "Low";
    const action = probability > 0.4 ? "Need to monitor!" : "No action needed.";
    const message = `${timeStr} / Fire Risk: ${riskLevel} / ${action}`;

    await alertsRef.child("Alert1").set(message);
    console.log(`✅ Alert1 → ${message}`);
  } catch (err) {
    console.error("❌ Prediction failed:", err.message);
  }
}

// Run once immediately
runPredictionCheck();

// Repeat every 10 minutes
setInterval(runPredictionCheck, 10 * 60 * 1000);
