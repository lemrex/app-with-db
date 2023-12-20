const express = require('express');
const mysql = require('mysql');

const app = express();
const port = 3000;

// Middleware to parse JSON and URL-encoded bodiesg
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
        <h2>Enter a Name</h2>
        <form action="/addName" method="post">
          <input type="text" name="name" placeholder="Enter your bad name" required>
          <button type="submit">Submit</button>
        </form>
      </body>
    </html>
  `);
});

// Express route to handle form submission and add name to the 'person' table
app.post('/addName', (req, res) => {
  const { name } = req.body;
  if (!name) {
    res.status(400).send('Name is required');
    return;
  }

  const insertQuery = 'INSERT INTO person (name) VALUES (?)'; // Modified query for 'person' table
  connection.query(insertQuery, [name], (error, results) => {
    if (error) {
      res.status(500).send('Error adding name to the database');
      throw error;
    }
    res.send('Name added successfully');
  });
});

// Express route to get all names from the 'person' table
app.get('/names', (req, res) => {
  connection.query('SELECT * FROM person', (error, results) => { // Modified query for 'person' table
    if (error) {
      res.status(500).send('Error fetching names from the database');
      throw error;
    }
    res.json(results);
  });
});

app.listen(port, () => {
  console.log(`Server is runnings on port ${port}`);
});
