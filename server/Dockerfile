FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Install deps first for cache reuse.
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

# Run as a non-root user; HOME=/root is preserved via the volume mount in compose
# which is where config.yaml lives. We keep root here intentionally so that
# bind-mounted ~/.config/beans config files retain their owner mapping on Linux.
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://localhost:8000/health', timeout=3).status==200 else 1)"

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
