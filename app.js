const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
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

const logTimestampMiddleware = (request, response, next) => {
  const timestamp = new Date().toISOString();
  console.log(`${timestamp}: ${request.method} ${request.url}`);

  next();
};

app.get("/posts", logTimestampMiddleware, async (request, response) => {
  const getPostsQuery = `SELECT * 
                        FROM Post 
                        JOIN User 
                        ON Post.UserID = User.UserID`;
  const postsArray = await db.all(getPostsQuery);
  response.send(postsArray);
});

/*

//Register user API
app.post("/register/", async (request, response) => {
  const { username, password, name, gender } = request.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  const selectUserQuery = `SELECT * 
     FROM user 
     WHERE username = '${username}';`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    if (password.length < 6) {
      response.status(400);
      response.send("Password is too short");
    } else {
      const createUserQuery = `INSERT INTO 
        user(username,name,password,gender)
       VALUES 
        (
            '${username}',
            '${name}',
            '${hashedPassword}',
            '${gender}'
        );`;
      await db.run(createUserQuery);
      response.send("User created successfully");
    }
  } else {
    response.status(400);
    response.send("User already exists");
  }
});





//Login user API
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * 
     FROM user 
     WHERE username = '${username}';`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = { username: username, user_id: dbUser.user_id };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ jwtToken: jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//AuthenticateToken Middleware Function
const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        request.user_id = payload.user_id;
        //console.log(payload);
        next();
      }
    });
  }
};

//3.GET tweets API
app.get("/user/tweets/feed/", authenticateToken, async (request, response) => {
  const { username, user_id } = request;
  const getTweeksQuery = `SELECT user.username, tweet.tweet , tweet.date_time as dateTime
     FROM tweet NATURAL JOIN user
     WHERE user.user_id IN (
         SELECT following_user_id
         FROM follower 
         WHERE follower_user_id = ${user_id}
     )
     ORDER BY tweet.date_time DESC
     LIMIT 4;`;
  const tweetsArray = await db.all(getTweeksQuery);
  response.send(tweetsArray);
});

//4.GET following users names
app.get("/user/following/", authenticateToken, async (request, response) => {
  const { username, user_id } = request;
  const getFollowingUsersNamesQuery = `SELECT name
     FROM user
     WHERE user_id IN (
         SELECT following_user_id
         FROM follower 
         WHERE follower_user_id = ${user_id}
     );`;
  const followingUsersArray = await db.all(getFollowingUsersNamesQuery);
  response.send(followingUsersArray);
});

//5.GET followers users names
app.get("/user/followers/", authenticateToken, async (request, response) => {
  const { username, user_id } = request;
  const getFollowersUsersNamesQuery = `SELECT name
     FROM user
     WHERE user_id IN (
         SELECT follower_user_id
         FROM follower 
         WHERE following_user_id = ${user_id}
     );`;
  const followersUsersArray = await db.all(getFollowersUsersNamesQuery);
  response.send(followersUsersArray);
});

const authenticateCheckValidFollowingUsers = async (
  request,
  response,
  next
) => {
  const { username, user_id } = request;
  const { tweetId } = request.params;
  const getFollowings = `
         SELECT following_user_id as user_id
         FROM follower 
         WHERE follower_user_id = ${user_id};`;
  let followingUsers = await db.all(getFollowings);
  let followingUsersArray = [];
  followingUsers.forEach((each) => {
    followingUsersArray.push(each.user_id);
  });

  const getUserOfTweet = `SELECT user_id 
   FROM tweet 
   WHERE tweet_id = ${tweetId};`;
  const tweetedUser = await db.get(getUserOfTweet);
  let res = followingUsersArray.includes(tweetedUser.user_id);
  if (res === true) {
    next();
  } else {
    response.status(401);
    response.send("Invalid Request");
  }
};

//6.
app.get("/tweets/:tweetId/", authenticateToken, async (request, response) => {
  const { username, user_id } = request;
  const { tweetId } = request.params;
  const getTweetQuery = `SELECT tweet,
            (SELECT count(like_id) 
             FROM like 
             WHERE tweet_id = tweet.tweet_id) AS likes,
            (SELECT count(reply_id) 
             FROM reply
             WHERE tweet_id = tweet.tweet_id) AS replies,
            date_time AS dateTime
     FROM tweet
     WHERE tweet_id = ${tweetId}
        AND user_id IN (SELECT following_user_id
                        FROM follower
                        WHERE follower_user_id = ${user_id});`;
  const tweet = await db.all(getTweetQuery);

  if (tweet.length === 0) {
    response.status(401);
    response.send("Invalid Request");
  } else {
    response.send(tweet[0]);
  }
});

//7.
app.get(
  "/tweets/:tweetId/likes/",
  authenticateToken,
  authenticateCheckValidFollowingUsers,
  async (request, response) => {
    const { username, user_id } = request;
    const { tweetId } = request.params;
    const getTweetQuery = `SELECT username
     FROM user
     WHERE user_id IN (
         SELECT user_id 
         FROM like 
         WHERE tweet_id = ${tweetId}
     );`;
    const tweet = await db.all(getTweetQuery);
    let userArray = [];
    tweet.forEach((each) => {
      userArray.push(each.username);
    });
    response.send({ likes: userArray });
  }
);

//8.
app.get(
  "/tweets/:tweetId/replies/",
  authenticateToken,
  authenticateCheckValidFollowingUsers,
  async (request, response) => {
    const { username, user_id } = request;
    const { tweetId } = request.params;
    const getRepliesQuery = `SELECT user.name,reply.reply
     FROM reply NATURAL JOIN user 
     WHERE tweet_id = ${tweetId};`;
    const replies = await db.all(getRepliesQuery);
    response.send({ replies: replies });
  }
);

//9.
app.get("/user/tweets/", authenticateToken, async (request, response) => {
  const { username, user_id } = request;
  const getTweetsQuery = `SELECT tweet,
            (SELECT count(like_id) 
             FROM like 
             WHERE tweet_id = tweet.tweet_id) AS likes,
            (SELECT count(reply_id) 
             FROM reply
             WHERE tweet_id = tweet.tweet_id) AS replies,
            date_time AS dateTime
     FROM tweet
     WHERE tweet.user_id = ${user_id};`;
  const tweets = await db.all(getTweetsQuery);
  response.send(tweets);
});

//10.
app.post("/user/tweets/", authenticateToken, async (request, response) => {
  const { username, user_id } = request;
  const { tweet } = request.body;
  const date = new Date();
  const createTweetQuery = `INSERT INTO 
    tweet(
        tweet,
        user_id,
        date_time
    )
   VALUES(
       '${tweet}',
       ${user_id},
       '${date}'
   );`;
  await db.run(createTweetQuery);
  response.send("Created a Tweet");
});

//11.
app.delete(
  "/tweets/:tweetId/",
  authenticateToken,
  async (request, response) => {
    const { username, user_id } = request;
    const { tweetId } = request.params;
    const getUserOfTweet = `SELECT user_id 
   FROM tweet 
   WHERE tweet_id = ${tweetId};`;
    const tweetedUser = await db.get(getUserOfTweet);
    if (tweetedUser.user_id !== user_id) {
      response.status(401);
      response.send("Invalid Request");
    } else {
      const deleteTweetQuery = `DELETE FROM tweet 
       WHERE tweet_id = ${tweetId};`;
      await db.run(deleteTweetQuery);
      response.send("Tweet Removed");
    }
  }
);

module.exports = app;


*/
