# Reelwise production image: the Next.js web app and the render/publish worker.
# The same image runs as the web app (ROLE=web), the worker (ROLE=worker) or both (ROLE=all).
# The worker needs FFmpeg, a headless Chrome for Remotion and (optionally) Piper for English voices.
FROM node:22-bookworm-slim

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    STORAGE_DIR=/data/storage \
    PIPER_PYTHON=/opt/piper/bin/python \
    PIPER_MODEL=/opt/piper/en-us-libritts-high.onnx

# FFmpeg, fonts and the shared libraries Remotion's headless Chrome needs.
RUN apt-get update && apt-get install -y --no-install-recommends \
      ffmpeg ca-certificates curl tini python3 python3-venv \
      fonts-noto-core fonts-noto-color-emoji \
      libnss3 libdbus-1-3 libatk1.0-0 libatk-bridge2.0-0 libgbm1 libasound2 libxrandr2 \
      libxkbcommon0 libxfixes3 libxcomposite1 libxdamage1 libpango-1.0-0 libcairo2 libcups2 \
    && rm -rf /var/lib/apt/lists/*

# Piper neural voice for English narration (LibriTTS, CC BY 4.0). Telugu always uses ElevenLabs "Bunty".
ARG INSTALL_PIPER=1
RUN if [ "$INSTALL_PIPER" = "1" ]; then \
      python3 -m venv /opt/piper && /opt/piper/bin/pip install --no-cache-dir piper-tts numpy "setuptools<81" && \
      curl -fsSL https://github.com/rhasspy/piper/releases/download/v0.0.2/voice-en-us-libritts-high.tar.gz | tar xz -C /opt/piper ; \
    fi

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
# Remotion downloads its own pinned headless Chrome.
RUN npx remotion browser ensure

COPY . .
RUN rm -f .env && npm run build

EXPOSE 3000
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["sh", "scripts/start.sh"]
