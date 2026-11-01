# Reelwise on a free Hugging Face Docker Space (CPU basic: 2 vCPU, 16 GB RAM).
# Builds the app straight from GitHub. Secrets to add in the Space settings:
#   DATABASE_URL (Neon connection string), ENCRYPTION_KEY, GEMINI_API_KEY
FROM node:22-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
      git ffmpeg ca-certificates curl tini python3 python3-venv fonts-noto-core fonts-noto-color-emoji \
      libnss3 libdbus-1-3 libatk1.0-0 libatk-bridge2.0-0 libgbm1 libasound2 libxrandr2 \
      libxkbcommon0 libxfixes3 libxcomposite1 libxdamage1 libpango-1.0-0 libcairo2 libcups2 \
    && rm -rf /var/lib/apt/lists/*

# English voice (Piper, LibriTTS CC BY 4.0). Telugu always uses ElevenLabs "Bunty".
RUN python3 -m venv /opt/piper && /opt/piper/bin/pip install --no-cache-dir piper-tts numpy "setuptools<81" \
    && curl -fsSL https://github.com/rhasspy/piper/releases/download/v0.0.2/voice-en-us-libritts-high.tar.gz | tar xz -C /opt/piper

ARG REELWISE_REF=claude/stoic-bohr-7yfk8e
RUN git clone --depth 1 --branch "$REELWISE_REF" https://github.com/nikileshvarma889-ship-it/novatrix.git /src \
    && mv /src/reelwise /app && rm -rf /src /app/mobile && chown -R node:node /app

# Hugging Face runs the container as user 1000 (the image's "node" user).
USER node
WORKDIR /app
ENV HOME=/home/node NEXT_TELEMETRY_DISABLED=1
RUN npm ci --include=dev --no-audit --no-fund \
    && node -e "require('@remotion/renderer').ensureBrowser().then(() => console.log('Chrome ready'))" \
    && NODE_ENV=production npm run build

ENV NODE_ENV=production PORT=7860 ROLE=all STORAGE_DIR=/tmp/reelwise-storage RENDER_CONCURRENCY=2 \
    APP_URL=https://lnikileshvarma-reelwise.hf.space \
    AI_PROVIDER=gemini GEMINI_MODEL=gemini-flash-latest GEMINI_FALLBACK_MODEL=gemini-flash-lite-latest \
    PIPER_PYTHON=/opt/piper/bin/python PIPER_MODEL=/opt/piper/en-us-libritts-high.onnx \
    ELEVENLABS_DEFAULT_VOICE=Bunty ELEVENLABS_MODEL=eleven_v3 ELEVENLABS_LANGUAGE=te

EXPOSE 7860
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["sh", "scripts/start.sh"]
