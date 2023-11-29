const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");

const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());
let db = null;
const dbPath = path.join(__dirname, "blogApplication.db");

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server is running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(e);
    process.exit(1);
  }
};
initializeDBAndServer();

//Create an Express.js middleware that logs the timestamp and the requested URL for every incoming request.
const logTimestampMiddleware = (request, response, next) => {
  const timestamp = new Date().toISOString();
  console.log(`${timestamp}: ${request.method} ${request.url}`);

  next();
};

//Implement an Express.js route that retrieves a list of posts from the database and returns it as JSON.
app.get("/posts", logTimestampMiddleware, async (request, response) => {
  const getPostsQuery = `SELECT * 
                        FROM Post 
                        JOIN User 
                        ON Post.UserID = User.UserID`;
  const postsArray = await db.all(getPostsQuery);
  response.send(postsArray);
});

