import pandas as pd
import xgboost as xgb
import os
import json
import hashlib
from datetime import datetime, timedelta
from ta.momentum import RSIIndicator
from ta.trend import MACD, SMAIndicator
from ta.volatility import AverageTrueRange, BollingerBands
from schemas.payload import RawCandle
from typing import List, Optional

# RC-006: Direktori untuk persistensi model
MODEL_DIR = os.path.join(os.path.dirname(__file__), "..", "saved_models")
MODEL_META_FILE = os.path.join(MODEL_DIR, "model_metadata.json")
MODEL_FILE_PREFIX = "xgboost_"

# Konfigurasi retrain — model di-retrain setiap 4 jam (16 siklus cron 15-menit)
RETRAIN_INTERVAL_HOURS = 4


def _ensure_model_dir():
    """Pastikan direktori saved_models ada."""
    os.makedirs(MODEL_DIR, exist_ok=True)


def _get_model_path(symbol: str) -> str:
    """Dapatkan path file model untuk symbol tertentu (sanitized)."""
    safe_symbol = symbol.replace("/", "_").replace("\\", "_")
    return os.path.join(MODEL_DIR, f"{MODEL_FILE_PREFIX}{safe_symbol}.json")


def _compute_data_hash(candles: List[RawCandle]) -> str:
    """
    Hitung hash dari data candle terbaru untuk mendeteksi apakah
    data sudah berubah signifikan dan model perlu di-retrain.
    """
    last_candles = sorted(candles, key=lambda c: c.timestamp)[-50:]
    data_str = "".join(
        f"{c.timestamp}{c.close}" for c in last_candles
    )
    return hashlib.sha256(data_str.encode()).hexdigest()[:16]


def _load_metadata() -> dict:
    """Load metadata model dari file JSON."""
    _ensure_model_dir()
    if os.path.exists(MODEL_META_FILE):
        try:
            with open(MODEL_META_FILE, "r") as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            return {}
    return {}


def _save_metadata(metadata: dict):
    """Simpan metadata model ke file JSON."""
    _ensure_model_dir()
    with open(MODEL_META_FILE, "w") as f:
        json.dump(metadata, f, indent=2)


def _should_retrain(symbol: str, data_hash: str) -> bool:
    """
    Tentukan apakah model perlu di-retrain berdasarkan:
    1. Model belum ada
    2. Data terbaru berbeda dari data training terakhir (data_hash berbeda)
    3. Interval retrain sudah terlewati (default 4 jam)
    """
    metadata = _load_metadata()
    symbol_meta = metadata.get(symbol, {})

    if not symbol_meta:
        return True  # Model belum pernah dilatih

    last_train = symbol_meta.get("last_train_ts", 0)
    last_hash = symbol_meta.get("last_data_hash", "")

    # Cek interval retrain
    last_train_dt = datetime.fromtimestamp(last_train / 1000) if last_train > 0 else datetime.min
    if datetime.now() - last_train_dt > timedelta(hours=RETRAIN_INTERVAL_HOURS):
        return True

    # Cek perubahan data
    if last_hash != data_hash:
        return True

    return False


def _save_model(symbol: str, model: xgb.XGBRegressor, data_hash: str):
    """Simpan model XGBoost ke file JSON dan update metadata."""
    _ensure_model_dir()
    model_path = _get_model_path(symbol)

    model.save_model(model_path)

    # Update metadata
    metadata = _load_metadata()
    metadata[symbol] = {
        "last_train_ts": int(datetime.now().timestamp() * 1000),
        "last_data_hash": data_hash,
        "model_path": model_path,
        "features": ["close", "rsi", "macd", "macd_signal", "atr", "bb_width", "vol_sma"],
    }
    _save_metadata(metadata)


def _load_model(symbol: str) -> Optional[xgb.XGBRegressor]:
    """Load model XGBoost dari file JSON jika tersedia."""
    model_path = _get_model_path(symbol)
    if os.path.exists(model_path):
        try:
            model = xgb.XGBRegressor()
            model.load_model(model_path)
            return model
        except Exception:
            # File model corrupt — hapus dan retrain
            os.remove(model_path)
            return None
    return None


def _extract_features(candles: List[RawCandle]) -> pd.DataFrame:
    """
    Ekstrak fitur teknikal dari data candle mentah.
    Pure function, tidak ada side effects.
    """
    df = pd.DataFrame([c.model_dump() for c in candles])
    df = df.sort_values('timestamp').reset_index(drop=True)

    df['rsi'] = RSIIndicator(close=df['close'], window=14).rsi()

    macd = MACD(close=df['close'])
    df['macd'] = macd.macd()
    df['macd_signal'] = macd.macd_signal()

    df['atr'] = AverageTrueRange(high=df['high'], low=df['low'], close=df['close'], window=14).average_true_range()

    bb = BollingerBands(close=df['close'], window=20, window_dev=2)
    df['bb_width'] = bb.bollinger_wband()

    df['vol_sma'] = SMAIndicator(close=df['volume'], window=20).sma_indicator()

    # Target: harga close candle berikutnya
    df['target'] = df['close'].shift(-1)

    return df


def predict_with_xgboost(candles: List[RawCandle]) -> float:
    """
    Prediksi harga candle berikutnya menggunakan XGBoost.
    
    RC-006: Model disimpan ke disk dan di-load ulang jika data belum berubah.
    Retrain hanya dilakukan jika data berubah atau interval retrain terlewati.
    """
    if len(candles) < 50:
        raise ValueError(f"Data historis tidak mencukupi: {len(candles)} < 50")

    df = _extract_features(candles)

    # Ambil symbol dari candle pertama (untuk model persistence key)
    # Jika tidak ada, gunakan "default"
    symbol = candles[0].symbol if hasattr(candles[0], 'symbol') and candles[0].symbol else "default"

    current_features = df.iloc[-1:].copy()
    train_df = df.dropna().copy()

    if len(train_df) < 50:
        raise ValueError("Data historis tidak mencukupi setelah kalkulasi indikator.")

    data_hash = _compute_data_hash(candles)

    features = ['close', 'rsi', 'macd', 'macd_signal', 'atr', 'bb_width', 'vol_sma']
    X_train = train_df[features]
    y_train = train_df['target']
    X_current = current_features[features]

    # RC-006: Coba load model dari disk
    model = None
    if not _should_retrain(symbol, data_hash):
        model = _load_model(symbol)
        if model is not None:
            # Model loaded successfully — langsung prediksi tanpa retrain
            prediction = model.predict(X_current)[0]
            return float(prediction)

    # Model perlu di-retrain atau belum ada
    model = xgb.XGBRegressor(
        n_estimators=100,
        learning_rate=0.05,
        max_depth=4,
        objective='reg:squarederror',
        random_state=42,  # RC-006: Deterministic untuk reproducibility
    )
    model.fit(X_train, y_train)

    # RC-006: Simpan model ke disk
    try:
        _save_model(symbol, model, data_hash)
    except Exception as e:
        # Gagal menyimpan model bukanlah fatal — prediksi tetap berjalan
        print(f"[XGBoost] Warning: Gagal menyimpan model untuk {symbol}: {e}")

    prediction = model.predict(X_current)[0]

    return float(prediction)