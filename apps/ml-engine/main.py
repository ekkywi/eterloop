from fastapi import FastAPI, HTTPException
from schemas.payload import LinearRegressionRequest, PredictionResponse, XGBoostRequest
from models.linear import predict_next_price
from models.xgboost_model import predict_with_xgboost

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

@app.post("/predict/xgboost", response_model=PredictionResponse)
async def xgboost_endpoint(payload: XGBoostRequest):
    try:
        predicted_value = predict_with_xgboost(payload.candles)
        return PredictionResponse(prediction=predicted_value)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
async def health_check():
    return {"status": "ok", "engine": "online"}