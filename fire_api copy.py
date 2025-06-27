from flask import Flask, request, jsonify
import joblib
import pandas as pd

app = Flask(__name__)
model = joblib.load("fire_model_balanced.pkl")


@app.route("/health", methods=["GET"])
def health():
    return jsonify({status: "ok"});

@app.route("/predict", methods=["POST"])
def predict():
    data = request.get_json()
    features = pd.DataFrame([{
        "Temperature[C]": data.get("Heat", 0),
        "Humidity[%]": data.get("Humidity", 50),
        "TVOC[ppb]": data.get("Smoke", 0),
        "eCO2[ppm]": data.get("eCO2", 400)
    }])
    prob = model.predict_proba(features)[0][1]
    status = "🔥 Fire risk!" if prob > 0.4 else "✅ Safe"
    return jsonify({ "probability": prob, "status": status })
