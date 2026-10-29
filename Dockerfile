# Use official lightweight Node.js image
FROM node:22-alpine

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Install dependencies (including tsx for running server.ts)
RUN npm install

# Copy source code and public assets
COPY . .

# Build production client bundle into dist/
RUN npm run build

# Default environment for Cloud Run
ENV PORT=8080
ENV NODE_ENV=production

# Expose target port
EXPOSE 8080

# Start the CineMinde fullstack server
CMD ["npm", "start"]
