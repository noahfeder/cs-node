/* An app will go here */
const express = require('express');
const app = express();
const pgp = require('pg-promise')();
const PORT = ENV['PORT'] || 9001;
const bcrypt = requre('bcrypt-as-promised');
const db = pgp('postgres://stavro510@localhost:5432/cs-server_development');

const invalid = {
  error: true,
  message: "Invalid username/password",
};
const valid = {
  error: false,
  message: "Success",
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
    .then( match => res.json({ ...valid, data: user }) );
  });
});

app.post('/signup', (req, res) => {
  let { username, password } = getData(req.body);

  bcrypt.hash(password, 10)
  .then( hashed => {
    db.one('INSERT INTO users(username,password_digest) VALUES ($1,$2) RETURNING *;',[username, hashed])
    .catch( error => res.json(invalid) )
    .then( user => res.json({ ...valid, data: user }))
  })
});

app.get('/user/:id', (req, res) => {
  let userId = req.params.id;
  db.many('SELECT * FROM binaries WHERE user_id = $1', [userId])
  .catch( error => res.json({ ...invalid, message: "You haven't asked for any help yet!" }) )
  .then( data => res.json(data) );
});

app.get('/', (req, res) => {
  db.many('SELECT * FROM binaries WHERE expiration >= $1', [Math.floor(Date.now() / 1000)])
  .catch( error => res.json([]))
  .then( data => res.json(data) );
});

app.get('/binaries/:id', (req, res) => {
  db.one('SELECT * FROM binaries WHERE id = $1', [req.params.id])
  .catch( error => res.json({}))
  .then( data => res.json(data) );
});

app.patch('/binaries/:id', (req, res) => {
  db.one('SELECT * FROM binaries WHERE id = $1', [req.params.id])
  .catch( error => res.json({}))
  .then( data => {
    if (data.expiration > Math.floor(Date.now() / 1000)) {
      db.one('SELECT * FROM votes WHERE binary_id = $1 AND user_id = $2',[req.params.id, req.body.user_id])
      .catch( error => {
        db.one('UPDATE binaries ')
      })
      .then( exists => res.json({ ...invalid, message: "Can't vote twice!" }) );
    } else {
      res.json({ ...invalid, message: message: "Sorry, voting for this decision has expired" });
    }
  })
});

//   def update
//     @params = JSON.load request.body
//     @binary = Binary.find(params[:id])
//     if (@binary.expiration > Time.now.to_i)
//       @vote = @binary.votes.find_by_user_id(@params["user_id"])
//       if @vote.nil?
//         @choice = @params["choice"]
//         @binary.votes.create({
//           user_id: @params["user_id"],
//           value: @choice
//         })
//         @binary.votesA += 1 if @choice == 1
//         @binary.votesB += 1 if @choice == 2
//         @binary.save
//         render json: @binary
//       else
//         render json: {error: true, message: "Can't vote twice!"}
//       end
//     else
//       render json: {error: true, }
//     end
//   end

//   def create
//     @params = JSON.load request.body
//     @user = User.find(@params["id"].to_i)
//     @binary = @user.binaries.new
//     @binary.expiration = calculateTime(@params["type"], @params["number"])
//     @binary.votesA = 1
//     @binary.votesB = 1
//     @binary.choiceA = @params["choiceA"]
//     @binary.choiceB = @params["choiceB"]
//     @binary.name = @params["name"]
//     @binary.content = @params["content"]
//     @binary.active = true
//     @binary.username = @user.username
//     @binary.save
//     render json: @binary
//   end

//   def calculateTime(type,number)
//     case type
//       when "hours"
//         return number.hours.to_i + Time.now.to_i
//       when "days"
//         return number.days.to_i + Time.now.to_i
//       when "minutes"
//         return number.minutes.to_i + Time.now.to_i
//     end
//   end

app.listen(PORT, () => console.log(`Listening on : ${PORT}`));
