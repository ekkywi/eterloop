from fastapi import FastAPI
from schemas.payload import LinearRegressionRequest, PredictionResponse
from models.linear import predict_next_price

app = FastAPI(
    title="Eterloop ML Engine",
    description="Microservice for Quantitative Trading Predictions",
    version="1.0.0"
)

@app.post("/predict/linear-regression", response_model=PredictionResponse)
async def linear_regression_endpoint(payload: LinearRegressionRequest):
    predicted_value = predict_next_price(
        X=payload.X,
        y=payload.y,
        current_features=payload.current_features
    )
    
    return PredictionResponse(prediction=predicted_value)

@app.get("/health")
async def health_check():
    return {"status": "ok", "engine": "online"}