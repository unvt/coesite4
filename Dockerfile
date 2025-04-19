FROM node:22.14.0

WORKDIR /app

COPY package*.json ./
RUN npm install
# RUN npm install mysql2 --save

COPY . .

# mysql2を使用するようにモジュールを修正
# RUN sed -i 's/require("mysql")/require("mysql2")/g' /app/node_modules/express-mysql-session/index.js

# 自己署名証明書の作成（開発環境用）
RUN mkdir -p certs \
    && openssl req -nodes -new -x509 \
       -subj "/C=JP/ST=Tokyo/L=Tokyo/O=Dev/CN=localhost" \
       -keyout certs/privkey.pem -out certs/cert.pem

EXPOSE 3000

CMD ["node", "app.js"]