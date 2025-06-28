from flask import Flask, request, jsonify
import joblib
import pandas as pd
import numpy as np
import tensorflow as tf
from datetime import datetime

# Initialize Flask app
app = Flask(__name__)

# Load models
fire_model = joblib.load("fire_model_balanced.pkl")
power_model = tf.keras.models.load_model("power_model.keras", compile=False)
occupancy_model = tf.keras.models.load_model("occupancy_model.keras", compile=False)

# Helper for LSTM input formatting
def prepare_lstm_input(data_dict, feature_order):
    df = pd.DataFrame([data_dict])
    df = df[feature_order]
    return np.expand_dims(df.values.astype(np.float32), axis=0)

@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})

@app.route("/predict", methods=["POST"])
def predict():
    try:
        data = request.get_json()

        ### --- Fire prediction ---
        fire_features = pd.DataFrame([{
            "Temperature[C]": data.get("Heat", 0),
            "Humidity[%]": data.get("Humidity", 50),
            "TVOC[ppb]": data.get("Smoke", 0),
            "eCO2[ppm]": data.get("eCO2", 400)
        }])
        fire_prob = fire_model.predict_proba(fire_features)[0][1]
        fire_status = "🔥 Fire risk!" if fire_prob > 0.4 else "✅ Safe"

        ### --- Power prediction (LSTM) ---
        power_input = prepare_lstm_input(data, [
            "Light1_status", "Light1_brightness",
            "Light2_status", "Light2_brightness",
            "Light3_status", "Light3_brightness",
            "current_mA", "power_mW"
        ])
        power_pred = power_model.predict(power_input)[0][0]
        power_status = "⚡ High usage" if power_pred > 2000 else "✅ Normal usage"

        ### --- Occupancy prediction (LSTM) ---
        occupancy_input = prepare_lstm_input(data, [
            "motion", "power_mW", "Light1_status", "Light2_status", "Light3_status"
        ])
        occ_pred = occupancy_model.predict(occupancy_input)[0][0]
        occ_status = "🚪 Active systems but no motion" if occ_pred > 0.5 else "✅ Occupancy aligns"

        # Format response
        response = {
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "fire_probability": round(fire_prob, 2),
            "fire_status": fire_status,
            "power_usage": round(float(power_pred), 2),
            "power_status": power_status,
            "occupancy_score": round(float(occ_pred), 2),
            "occupancy_status": occ_status
        }
        return jsonify(response)

    except Exception as e:
        return jsonify({"error": str(e)}), 500

import os

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 10000))  # default fallback
    app.run(host="0.0.0.0", port=port)
