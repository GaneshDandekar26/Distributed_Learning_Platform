# Use Node.js 18 alpine
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Expose port
EXPOSE 9090

# Start the development server
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
