const admin = require("firebase-admin");
const axios = require("axios");
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://smart-fire-system-684fb-default-rtdb.firebaseio.com"
});

const db = admin.database();
const fireRef = db.ref("SmartHomeSystem/SmartFireSystem");
const lightRef = db.ref("SmartHomeSystem/SmartLightSystem");
const garageRef = db.ref("SmartHomeSystem/SmartGarageDoorSystem");
const alertsRef = db.ref("SmartHomeSystem/Alerts");

function getTimeString() {
  const now = new Date();
  return now.toISOString().replace("T", " ").split(".")[0];
}

async function runAllPredictions() {
  try {
    // --- FIRE ---
    const fireSnap = await fireRef.once("value");
    const fireData = fireSnap.val();
    if (fireData) {
      const fireResp = await axios.post("https://fire-prediction-api.onrender.com/predict", fireData);
      const { probability } = fireResp.data;

      const fireLevel = probability > 0.4 ? "High" : "Low";
      const fireAction = probability > 0.4 ? "Need to monitor!" : "No action needed.";
      const fireMsg = `${getTimeString()} / Fire Risk: ${fireLevel} / ${fireAction}`;
      await alertsRef.child("Alert1").set(fireMsg);
      console.log("Alert1 →", fireMsg);
    }

    // --- POWER ---
    const lightSnap = await lightRef.once("value");
    const light = lightSnap.val();
    let highPowerRooms = [];

    for (let i = 1; i <= 3; i++) {
      const status = light[`Light${i}_status`];
      const brightness = light[`Light${i}_brightness`] || 0;
      if (status && brightness > 1000) {
        highPowerRooms.push(`Room ${i}`);
      }
    }

    let powerMsg = `${getTimeString()} / `;
    if (highPowerRooms.length > 0) {
      powerMsg += `${highPowerRooms.join(" and ")} lights during daytime may push total power above limit.`;
    } else {
      powerMsg += "No high power usage detected.";
    }
    await alertsRef.child("Alert2").set(powerMsg);
    console.log("Alert2 →", powerMsg);

    // --- OCCUPANCY ---
    const motion = garageRef.child("motion_detected");
    const garageSnap = await garageRef.once("value");
    const garage = garageSnap.val();
    const motionDetected = garage["motion_detected"];
    const garagePower = garage["power_mW"];

    let occMsg = `${getTimeString()} / `;
    if (garagePower > 500 && !motionDetected) {
      occMsg += "Garage system is active but no motion detected. Consider turning it off.";
    } else {
      occMsg += "Garage usage aligns with motion activity.";
    }
    await alertsRef.child("Alert3").set(occMsg);
    console.log("Alert3 →", occMsg);

  } catch (err) {
    console.error("Prediction failed:", err.message);
  }
}

// Run once immediately
runAllPredictions();

// Repeat every 10 minutes
setInterval(runAllPredictions, 10 * 60 * 1000);
