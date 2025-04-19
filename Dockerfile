FROM node:22.14.0

WORKDIR /app

COPY package*.json ./
RUN npm install
# RUN npm install mysql2 --save

COPY . .

# Generate self-signed certificate (for development environment)
RUN mkdir -p certs \
    && openssl req -nodes -new -x509 \
       -subj "/C=JP/ST=Tokyo/L=Tokyo/O=Dev/CN=localhost" \
       -keyout certs/privkey.pem -out certs/cert.pem

EXPOSE 3000

CMD ["node", "app.js"]