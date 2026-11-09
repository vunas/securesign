FROM python:3.12-slim AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
  build-essential \
  libpq-dev \
  && rm -rf /var/lib/apt/lists/*

RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

COPY pyproject.toml uv.lock ./
RUN pip install --upgrade pip uv \
  && uv export --frozen --no-dev --format requirements-txt > requirements.txt \
  && pip install --no-cache-dir -r requirements.txt

COPY ./app ./app
RUN python -m compileall -b /opt/venv/lib/python3.12/site-packages/ && \
  python -m compileall -b ./app

FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
  PATH="/opt/venv/bin:$PATH" \
  PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
  libpq5 \
  && rm -rf /var/lib/apt/lists/*

COPY --from=builder /opt/venv /opt/venv
COPY --from=builder /app/app ./app

RUN useradd -m -u 10001 appuser \
  && chown -R appuser:appuser /app

USER appuser

EXPOSE 8000

CMD exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1