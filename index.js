const express = require('express');
const app = express();
const pgp = require('pg-promise')();
const PORT = process.env['PORT'] || 9001;
const bcrypt = require('bcrypt-as-promised');
const db = pgp('postgres://stavro510@localhost:5432/cs-server_development');

const invalid = {
  error: true,
  message: "Invalid username/password.",
};
const valid = {
  error: false,
  message: "Success.",
};
const noRecord = {
  error: true,
  message: "No record found.",
};

function getData(body) {
  return {
    username: body.username.trim().toLowerCase(),
    password: body.password,
  };
};

app.post('/login', (req, res)  => {
  let { username, password } = getData(req.body);

  db.one('SELECT * FROM users WHERE username = $1', [username])
  .catch( error => res.json(invalid) )
  .then( user => {
    bcrypt.compare(password, user.password_digest)
    .catch( error => res.json(invalid) )
    .then( match => res.json(Object.assign({}, valid, { data: user })) );
  });
});

app.post('/signup', (req, res) => {
  let { username, password } = getData(req.body);

  bcrypt.hash(password, 10)
  .then( hashed => {
    db.one('INSERT INTO users(username,password_digest) VALUES ($1,$2) RETURNING *;',[username, hashed])
    .catch( error => res.json(invalid) )
    .then( user => res.json(Object.assign({}, valid, { data: user })))
  })
});

app.get('/user/:id', (req, res) => {
  let userId = req.params.id;
  db.many('SELECT * FROM binaries WHERE user_id = $1', [userId])
  .catch( error => res.json(Object.assign({}, invalid, { message: "You haven't asked for any help yet!" })) )
  .then( data => res.json(data) );
});

app.get('/binaries/:id', (req, res) => {
  db.one('SELECT * FROM binaries WHERE id = $1', [req.params.id])
  .catch( error => res.json(noRecord))
  .then( data => res.json(data) );
});

app.patch('/binaries/:id', (req, res) => {
  db.one('SELECT * FROM binaries WHERE id = $1', [req.params.id])
  .catch( error => res.json(noRecord))
  .then( data => {
    if (data.expiration > Math.floor(Date.now() / 1000)) {
      db.one('SELECT * FROM votes WHERE binary_id = $1 AND user_id = $2',[req.params.id, req.body.user_id])
      .catch( noVote => {
        let column = req.body.choice == 1 ? "votesA" : "votesB";
        db.one('UPDATE binaries SET $1 = $2 + 1 WHERE id = $3 RETURNING *', [column, column, req.params.id])
        .then( updated => {
          db.none('INSERT INTO votes(binary_id, user_id, value) VALUES($1, $2, $3)', [req.params.id, req.body.user_id, parseInt(req.body.choice,10)])
          .then( completed => res.json(updated) )
          .catch( error => res.json(invalid) );
        })
        .catch( error => res.json(invalid) );
      })
      .then( exists => res.json(Object.assign({}, invalid, { message: "Can't vote twice!" })) );
    } else {
      res.json(Object.assign({},invalid,{ message: "Sorry, voting for this decision has expired" }));
    }
  })
});

app.post('/binaries', (req, res) => {
  console.log('req:\n', req);
  console.log('res:\n', res);
  db.one('SELECT * FROM users WHERE id = $1', [req.body.id])
  .then( user => {
    db.one(
      'INSERT INTO binaries(user_id, expiration, votesA, votesB, choiceA, choiceB, name, content, active, username) VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *',
      [
        user.id,
        calculateTime(body.type, body.number),
        1,
        1,
        body.choiceA,
        body.choiceB,
        body.name,
        body.content,
        true,
        user.username
      ]
    )
    .then( binary => res.json(binary) )
    .catch( error => res.json({ error: true, message: "Could not create binary", }));
  })
  .catch( error => res.json(invalid));
})

function calculateTime(type = 'days', number = 1) {
  let now = Math.floor(Date.now() / 1000);
  let num = parseInt(number, 10);
  const MINUTE = 60;
  const HOUR = 60 * MINUTE;
  const DAY = 24 * HOUR;
  switch (type) {
    case 'minutes':
      return num * MINUTE + now;
    case 'hours':
      return num * HOUR + now;
    case 'days':
      return num * DAY + now;
    default:
      return DAY + now;
  }
}

app.get('/', (req, res) => {
  db.many('SELECT * FROM binaries WHERE expiration >= $1', [Math.floor(Date.now() / 1000)])
  .catch( error => res.json([]))
  .then( data => res.json(data) );
});
app.listen(PORT, () => console.log(`Listening on : ${PORT}`));
