from pydantic import BaseModel, Field
from typing import List

class LinearRegressionRequest(BaseModel):
    X: List[List[float]] = Field(..., description="Historical feature matrix")
    y: List[float] = Field(..., description="Historical target variables")
    current_features: List[float] = Field(..., description="Current features to predict the next target")

class PredictionResponse(BaseModel):
    prediction: float
    confidence_score: float = None