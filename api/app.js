// Import required modules
const express = require('express');

// Create Express app
const app = express();

// Define routes

// Route 1: Hello World
app.get('/', (req, res) => {
  res.send('Hello World!');
});

// Route 2: Get current date
app.get('/date', (req, res) => {
  const currentDate = new Date().toDateString();
  res.send(`Current date is: ${currentDate}`);
});

// Route 3: Get current time
app.get('/time', (req, res) => {
  const currentTime = new Date().toLocaleTimeString();
  res.send(`Current time is: ${currentTime}`);
});

// Route 4: Get list of users
app.get('/users', (req, res) => {
  const users = ['User1', 'User2', 'User3'];
  res.json(users);
});

// Route 5: Get specific user by ID
app.get('/users/:id', (req, res) => {
  const userId = req.params.id;
  const user = { id: userId, name: `User${userId}` };
  res.json(user);
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
