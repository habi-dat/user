FROM node:carbon

RUN git clone https://github.com/soudis/habidat-user.git
WORKDIR /habidat-user
RUN npm install
RUN npm install pm2 -g

RUN envsubst < config/config.json.sample > config/config.json

VOLUME /habidat-user/config

CMD pm2-docker start app.js 
