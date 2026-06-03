FROM node:18

# Cria pasta da aplicação
WORKDIR /app

# Copia dependências primeiro
COPY package*.json ./

# Instala dependências
RUN npm install

# Instala PM2
RUN npm install -g pm2

# Copia o restante do projeto
COPY . .

# Porta da API
EXPOSE 3232

# Inicialização com PM2
CMD ["pm2-runtime", "server.js"]