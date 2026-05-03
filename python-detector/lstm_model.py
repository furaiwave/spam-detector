from __future__ import annotations

from pathlib import Path
from typing import Final

import numpy as np
import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers

VOCAB_SIZE:   Final[int]   = 20_000
EMBED_DIM:    Final[int]   = 128
LSTM_UNITS:   Final[int]   = 256
LSTM_UNITS_2: Final[int]   = 128
DENSE_UNITS:  Final[int]   = 64
DROPOUT_RATE: Final[float] = 0.3
MAX_SEQ_LEN:  Final[int]   = 512
NUM_CLASSES:  Final[int]   = 4


class SpamLSTM:
    IDX_TO_LABEL: Final[dict[int, str]] = {
        0: "not_spam",
        1: "suspicious",
        2: "needs_review",
        3: "spam",
    }

    def __init__(self) -> None:
        self._model:     keras.Model | None = None
        self._tokenizer: keras.preprocessing.text.Tokenizer | None = None

    def build(self) -> keras.Model:
        inputs = keras.Input(shape=(MAX_SEQ_LEN,), dtype=tf.int32, name="token_ids")

        x = layers.Embedding(
            input_dim=VOCAB_SIZE,
            output_dim=EMBED_DIM,
            mask_zero=False,
            name="embedding",
        )(inputs)

        x = layers.Bidirectional(
            layers.LSTM(LSTM_UNITS, return_sequences=True), name="bilstm_1"
        )(x)
        x = layers.Dropout(DROPOUT_RATE)(x)
        x = layers.Bidirectional(
            layers.LSTM(LSTM_UNITS_2, return_sequences=True), name="bilstm_2"
        )(x)

        attn   = layers.Dense(1, activation="tanh", name="attention_scores")(x)
        weights = layers.Softmax(axis=1, name="attention_weights")(attn)
        attended = layers.Multiply()([x, weights])
        context  = layers.GlobalAveragePooling1D(name="context_vector")(attended)

        x       = layers.Dense(DENSE_UNITS, activation="relu", name="dense_1")(context)
        x       = layers.Dropout(DROPOUT_RATE)(x)
        outputs = layers.Dense(NUM_CLASSES, activation="softmax", name="logits")(x)

        model = keras.Model(inputs=inputs, outputs=outputs, name="spam_lstm")
        model.compile(
            optimizer=keras.optimizers.Adam(learning_rate=3e-4),
            loss="sparse_categorical_crossentropy",
            metrics=["accuracy"],
        )
        self._model = model
        return model

    def prepare_tokenizer(self, texts: list[str]) -> None:
        self._tokenizer = keras.preprocessing.text.Tokenizer(
            num_words=VOCAB_SIZE,
            oov_token="<OOV>",
        )
        self._tokenizer.fit_on_texts(texts)

    def tokenize(self, texts: list[str]) -> np.ndarray:
        if self._tokenizer is None:
            raise RuntimeError("Call prepare_tokenizer() first")
        seqs = self._tokenizer.texts_to_sequences(texts)
        return keras.preprocessing.sequence.pad_sequences(
            seqs, maxlen=MAX_SEQ_LEN, padding="post", truncating="post"
        )

    def predict_proba(self, text: str) -> tuple[float, list[float]]:
        if self._model is None:
            raise RuntimeError("Model not built or loaded")
        tokens = self.tokenize([text])
        probs: np.ndarray = self._model.predict(tokens, verbose=0)[0]
        return float(probs[3]), probs.tolist()

    def get_hidden_state(self, text: str) -> list[float]:
        if self._model is None:
            raise RuntimeError("Model not built or loaded")
        ctx_model = keras.Model(
            inputs=self._model.input,
            outputs=self._model.get_layer("context_vector").output,
        )
        tokens = self.tokenize([text])
        return ctx_model.predict(tokens, verbose=0)[0].tolist()

    def save(self, path: Path) -> None:
        if self._model is None:
            raise RuntimeError("No model to save")
        self._model.save(path / "lstm_model.keras")
        import json
        tok_json = self._tokenizer.to_json() if self._tokenizer else "{}"
        (path / "tokenizer.json").write_text(tok_json)

    def load(self, path: Path) -> None:
        self._model     = keras.models.load_model(path / "lstm_model.keras")
        tok_json        = (path / "tokenizer.json").read_text()
        self._tokenizer = keras.preprocessing.text.tokenizer_from_json(tok_json)