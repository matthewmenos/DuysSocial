"""Optional InsightFace matcher. Run: pip install insightface onnxruntime flask && python app.py"""
from flask import Flask, request, jsonify

app = Flask(__name__)


@app.post("/match")
def match():
    # If insightface is installed, compare faces; otherwise return pending-review score.
    try:
        from insightface.app import FaceAnalysis
        import requests, numpy as np, io
        from PIL import Image

        data = request.get_json(force=True)
        def load(url):
            r = requests.get(url, timeout=20)
            img = Image.open(io.BytesIO(r.content)).convert("RGB")
            return np.array(img)
        fa = FaceAnalysis(name="buffalo_l")
        fa.prepare(ctx_id=-1)
        a = fa.get(load(data["idUrl"]))
        b = fa.get(load(data["selfieUrl"]))
        if not a or not b:
            return jsonify(ok=False, confidence=0.0)
        sim = float(np.dot(a[0].normed_embedding, b[0].normed_embedding))
        return jsonify(ok=sim > 0.35, confidence=sim)
    except Exception as e:
        return jsonify(ok=False, confidence=0.0, error=str(e)[:200])


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5100)
