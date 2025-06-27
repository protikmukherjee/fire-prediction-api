const admin = require("firebase-admin");
const axios = require("axios");
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://smart-fire-system-684fb-default-rtdb.firebaseio.com"
});

const db = admin.database();
const systemRef = db.ref("SmartHomeSystem");
const alertsRef = db.ref("SmartHomeSystem/Alerts");

async function runPredictionCheck() {
  try {
    const snapshot = await systemRef.once("value");
    const data = snapshot.val();
    if (!data) {
      console.warn("⚠️ No data found in SmartHomeSystem");
      return;
    }

    const response = await axios.post("https://fire-prediction-api.onrender.com/predict", data);
    const { message } = response.data;

    await alertsRef.child("Alert1").set(message);
    console.log(`Alert1 → ${message}`);
  } catch (err) {
    console.error("Prediction failed:", err.message);
  }
}

runPredictionCheck();
setInterval(runPredictionCheck, 10 * 60 * 1000);  // every 10 minutes
