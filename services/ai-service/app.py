from flask import Flask, jsonify

app = Flask(__name__)

@app.get('/health')
def health():
    return jsonify({"status": "ok", "service": "ai-service"})

@app.get('/api/forecast')
def forecast():
    return jsonify({
        "providerId": "p-001",
        "forecast": [
            {"item": "Chicken Rice", "predictedDemand": 84},
            {"item": "Beef Burger", "predictedDemand": 48},
            {"item": "Vegetable Pasta", "predictedDemand": 31}
        ]
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001)
