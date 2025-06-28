#!/usr/bin/env python3
import sys, json, pickle
from datetime import datetime
import numpy as np
import tensorflow as tf

# ——— Load your pickled fire model ———
with open("fire_model_balanced.pkl", "rb") as f:
    fire_model = pickle.load(f)

# ——— Load the Keras occupancy & power models as before ———
occupancy_model = tf.keras.models.load_model("occupancy_model.h5", compile=False)
power_model     = tf.keras.models.load_model("power_model.h5",     compile=False)

def make_predictions(data):
    # ——— Fire input & pred ———
    f = data["SmartHomeSystem"]["SmartFireSystem"]
    x_fire = np.array([[
        f["Flame"], f["Heat"], f["Smoke"], f["power_mW"], f["index"]
    ]])
    # If your pickled model has predict_proba:
    try:
        p_fire = float(fire_model.predict_proba(x_fire)[0][1])
    except AttributeError:
        # fallback to raw predict
        p_fire = float(fire_model.predict(x_fire)[0])

    # ——— Occupancy input & pred ———
    L = data["SmartHomeSystem"]["SmartLightSystem"]
    G = data["SmartHomeSystem"]["SmartGarageDoorSystem"]
    x_occ = np.array([[
        int(L["Light1_status"]),
        int(L["Light2_status"]),
        int(L["Light3_status"]),
        L["Light1_brightness"],
        L["Light2_brightness"],
        L["Light3_brightness"],
        int(G.get("motion_detected", 0))
    ]])
    p_occ = float(occupancy_model.predict(x_occ)[0][0])

    # ——— Power input & pred ———
    p_pow = float(power_model.predict(x_occ)[0][0])

    # ——— Build recommendations (same as before) ———
    recs = []
    if p_fire > 0.4:
        recs.append("🔥 High fire risk detected – please monitor immediately.")
    # …etc…

    return p_fire, p_occ, p_pow, " | ".join(recs)

if __name__ == "__main__":
    payload = json.load(sys.stdin)
    fire_p, occ_p, pow_p, recommendation = make_predictions(payload)
    print(json.dumps({
        "fire_probability":       fire_p,
        "occupancy_probability":  occ_p,
        "power_prediction":       pow_p,
        "recommendation":         recommendation
    }))
