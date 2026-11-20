FROM node:20-slim

# A Puppeteer ne próbáljon saját Chromiumot letölteni,
# helyette a rendszerbe telepített 'chromium' csomagot használja.
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    NODE_ENV=production

# Chromium és a headless futtatáshoz szükséges rendszerkönyvtárak
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-liberation \
    fonts-freefont-ttf \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    xdg-utils \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/*

# Nem-root felhasználó, mert a Chrome root alatt nem szeret elindulni.
# Rendes home-mappát is kap, mert a Chrome ide próbál írni induláskor
# (profil, cache, crash-reporter adatbázis) - enélkül a Chrome elszáll.
RUN groupadd -r munkalapp && useradd -r -m -d /home/munkalapp -g munkalapp -G audio,video munkalapp \
  && mkdir -p /app \
  && chown -R munkalapp:munkalapp /app /home/munkalapp

ENV HOME=/home/munkalapp

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .
RUN chown -R munkalapp:munkalapp /app

USER munkalapp

EXPOSE 3000
CMD ["node", "server.js"]
