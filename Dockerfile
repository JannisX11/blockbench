FROM node:14-alpine
WORKDIR /app
EXPOSE 3000

ADD . /app

RUN npm install

ENTRYPOINT ["npx", "serve"]