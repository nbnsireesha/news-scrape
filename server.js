//dependencies
var bodyParser = require('body-parser');
var mongoose = require('mongoose');
var logger = require('morgan');

//initialize Express app
var express = require('express');
var app = express();

app.use(logger('dev'));
app.use(bodyParser.urlencoded({
  extended: false
}));

app.use(express.static(process.cwd() + '/public'));

var exphbs = require('express-handlebars');
app.engine('handlebars', exphbs({
  defaultLayout: 'main'
}));
app.set('view engine', 'handlebars');

mongoose.Promise = global.Promise;
//connecting to MongoDB
//mongoose.connect('mongodb://localhost/dbNews');
//mongoose.connect(' mongodb://heroku_fn781t2v:1gag9bqvl00p128lv11bkjghm@ds231658.mlab.com:31658/heroku_fn781t2v');
var MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost/dbNews";
mongoose.Promise = Promise;
mongoose.connect(MONGODB_URI, {
 useMongoClient: true
});

var db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function() {
  console.log('Connected to Mongoose!')
});

var routes = require('./controller/controller.js');
app.use('/', routes);

var port = process.env.PORT || 3000;
app.listen(port, function(){
  console.log('Listening on PORT ' + port);
});
