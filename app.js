const express = require('express');
const mysql = require('mysql');

const app = express();
const port = 3000;

// Middleware to parse JSON and URL-encoded bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Retrieve MySQL configuration from environment variables
const mysqlConfig = {
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DB
};

// MySQL connection setup using retrieved config
const connection = mysql.createConnection(mysqlConfig);

// Connect to MySQL
connection.connect((err) => {
  if (err) throw err;
  console.log('Connected to MySQL database');
});

// Express route to serve the HTML form
app.get('/', (req, res) => {
  res.send(`
    <html>
      <body>
        <h2>Enter Name, Age, and State</h2>
        <form action="/addInfo" method="post">
          <input type="text" name="name" placeholder="Enter your name" required><br>
          <input type="number" name="age" placeholder="Enter your age" required><br>
          <input type="text" name="state" placeholder="Enter your state" required><br>
          <button type="submit">Submit</button>
        </form>
      </body>
    </html>
  `);
});

// Express route to handle form submission and add info to the 'person' table
app.post('/addInfo', (req, res) => {
  const { name, age, state } = req.body;
  if (!name || !age || !state) {
    res.status(400).send('Name, Age, and State are required');
    return;
  }

  const insertQuery = 'INSERT INTO person (name, age, state) VALUES (?, ?, ?)';
  connection.query(insertQuery, [name, age, state], (error, results) => {
    if (error) {
      res.status(500).send('Error adding info to the database');
      throw error;
    }
    res.send('Info added successfully');
  });
});

// Express route to get all info from the 'person' table
app.get('/info', (req, res) => {
  connection.query('SELECT * FROM person', (error, results) => {
    if (error) {
      res.status(500).send('Error fetching info from the database');
      throw error;
    }
    res.json(results);
  });
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
