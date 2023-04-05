/*
DROP TABLE IF EXISTS scores;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS verify;

CREATE TABLE users
(
    username TEXT PRIMARY KEY,
    password TEXT NOT NULL,
    verified INTEGER NOT NULL
);

CREATE TABLE scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL,
  score INTEGER NOT NULL
);

CREATE TABLE verify (
  username TEXT PRIMARY KEY,
  token TEXT NOT NULL
);

SELECT * FROM scores;
SELECT * FROM users;
SELECT * FROM verify;
*/
