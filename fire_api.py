#!/usr/bin/env python3

# ——— 1) Patch InputLayer to drop batch_shape ———
import tensorflow as _tf
_orig_input_init = _tf.keras.layers.InputLayer.__init__
def _patched_input_init(self, *args, **kwargs):
    bs = kwargs.pop("batch_shape", None)
    if bs is not None:
        kwargs["input_shape"] = tuple(bs[1:])
    return _orig_input_init(self, *args, **kwargs)
_tf.keras.layers.InputLayer.__init__ = _patched_input_init

# ——— 2) Now import everything else ———
import sys, json, pickle
from datetime import datetime
import numpy as np
import tensorflow as tf
from tensorflow.keras.mixed_precision import Policy as DTypePolicy
from tensorflow.keras.utils import custom_object_scope

# ——— 3) Load your pickled fire model ———
with open("fire_model_balanced.pkl", "rb") as f:
    fire_model = pickle.load(f)

# ——— 4) Load Keras models inside a custom_object_scope for DTypePolicy ———
with custom_object_scope({'DTypePolicy': DTypePolicy}):
    occupancy_model = tf.keras.models.load_model("occupancy_model.h5", compile=False)
    power_model     = tf.keras.models.load_model("power_model.h5",     compile=False)

def make_predictions(data):
    # — Fire prediction —
    f = data["SmartHomeSystem"]["SmartFireSystem"]
    x_fire = np.array([[f["Flame"], f["Heat"], f["Smoke"], f["power_mW"], f["index"]]])
    try:
        p_fire = float(fire_model.predict_proba(x_fire)[0][1])
    except:
        p_fire = float(fire_model.predict(x_fire)[0])

    # — Occupancy prediction —
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

    # — Power prediction —
    p_pow = float(power_model.predict(x_occ)[0][0])

    # — Build human-readable recommendations —
    recs = []
    if p_fire > 0.4:
        recs.append("🔥 High fire risk detected – please monitor immediately.")
    tot = data["SmartHomeSystem"]["SystemOverview"]["total_power_mW"]
    thr = data["SmartHomeSystem"].get("threshold_power_mW", None)
    hour = datetime.now().hour
    if thr and 6 <= hour <= 18 and tot > thr:
        recs.append(f"Room lights during daytime may push total power ({tot:.0f} mW) above limit ({thr}).")
    if not G.get("motion_detected", False) and G.get("isOn", False):
        recs.append("Garage system has been idle for a while. Consider turning it off.")
    if p_occ < 0.2 and tot > (thr or 0):
        recs.append("Power usage is high but no motion detected. System may be unnecessarily active.")
    if (hour < 6 or hour > 22) and p_occ < 0.5 and L["Light3_status"]:
        recs.append("It's late and no one is in the kitchen (room 3). Consider turning selected appliances off.")
    recs.append("Trend analysis over the last 7 days not yet implemented.")

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
