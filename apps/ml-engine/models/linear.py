import numpy as np
from sklearn.linear_model import LinearRegression
from fastapi import HTTPException

def predict_next_price(X: list[list[float]], y: list[float], current_features: list[float]) -> float:
    if len(X) != len(y):
        raise HTTPException(status_code=400, detail="Dimensi X dan y tidak cocok")
    if len(X) == 0:
        raise HTTPException(status_code=400, detail="Dataset historis kosong")
    if len(X[0]) != len(current_features):
        raise HTTPException(status_code=400, detail="Jumlah fitur current_features tidak sesuai dengan matriks x")
    
    X_np = np.array(X)
    y_np = np.array(y)
    current_np = np.array(current_features).reshape(1, -1)

    model = LinearRegression()
    model.fit(X_np, y_np)

    prediction = model.predict(current_np)

    return float(prediction[0])