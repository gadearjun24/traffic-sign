import sys
import json
import base64
import io
from PIL import Image
import torch
from ultralytics import YOLO
from ultralytics.nn.tasks import DetectionModel
from ultralytics.nn.modules import Conv
from torch.nn.modules.container import Sequential

# ✅ Allowlist all classes for safe PyTorch 2.6+ weights loading
torch.serialization.add_safe_globals([DetectionModel, Conv, Sequential])

# Load YOLOv8 nano pretrained model
try:
    # model = YOLO(".pt")
    model = torch.load('yolov8n.pt', weights_only=False)
except Exception as e:
    print(json.dumps({"error": f"Model load failed: {str(e)}"}))
    sys.stdout.flush()
    sys.exit(1)


def process_frame(b64_img):
    """Decode base64 image, run YOLOv8 detection, return structured detections."""
    try:
        img_data = base64.b64decode(b64_img)
        img = Image.open(io.BytesIO(img_data)).convert("RGB")
        results = model.predict(img, imgsz=640, conf=0.25, verbose=False)

        detections = []
        for r in results[0].boxes:
            xyxy = r.xyxy[0].cpu().numpy().tolist()
            cls = int(r.cls[0].cpu().numpy())
            conf = float(r.conf[0].cpu().numpy())
            label = results[0].names[cls]
            detections.append({
                "class": label,
                "confidence": round(conf, 4),
                "bbox": [round(x, 2) for x in xyxy]
            })
        return detections
    except Exception as e:
        return {"error": f"Frame processing failed: {str(e)}"}


# ✅ Read JSON input line-by-line from Node.js
for line in sys.stdin:
    try:
        data = json.loads(line.strip())
        if "frame" in data:
            dets = process_frame(data["frame"])
            output = json.dumps({"detections": dets})
            print(output)
            sys.stdout.flush()
    except Exception as e:
        print(json.dumps({"error": f"Invalid input JSON: {str(e)}"}))
        sys.stdout.flush()
