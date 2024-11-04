# Use official Node.js image
FROM node:14-alpine

# Set working directory to root
WORKDIR /

# Copy package.json and package-lock.json to root
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application files to root
COPY . .

# Expose port
EXPOSE 8000

# Run the application
CMD ["node", "main.js"]
