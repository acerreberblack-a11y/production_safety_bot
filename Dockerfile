# Use official Node.js LTS image
FROM node:20-alpine

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Bundle app source
COPY . .

# Expose necessary port (if any - bot doesn't listen on port but for completeness maybe? but maybe not needed). We'll not expose.
# Start the bot
CMD ["node", "src/bot.js"]
