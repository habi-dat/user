FROM node:boron

RUN git clone https://github.com/soudis/habidat-user.git
WORKDIR /habidat-user
RUN npm install
RUN npm install pm2 -g


VOLUME config

CMD pm2-docker start app.js 