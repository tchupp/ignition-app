FROM node:8.12.0-alpine

WORKDIR /app

COPY ./.webpack /app
RUN yarn install

EXPOSE 8080

ENTRYPOINT node /app/index.js

