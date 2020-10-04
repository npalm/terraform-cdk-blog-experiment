FROM node:lts
LABEL author="Niek Palm <dev.npalm@gmail.com>"  
RUN npm install --global cdktf-cli@next

RUN apt-get update && apt install software-properties-common git zip curl apt-transport-https -y
RUN curl -fsSL https://apt.releases.hashicorp.com/gpg | apt-key add -
RUN apt-add-repository "deb [arch=amd64] https://apt.releases.hashicorp.com $(lsb_release -cs) main"
RUN apt-get update && apt-get install terraform -y
RUN terraform -install-autocomplete