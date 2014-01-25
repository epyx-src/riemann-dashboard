var express = require('express'),
    http = require('http'),
    path = require('path'),
    app = express();

// Remember: The order of the middleware matters!

// Everything in public will be accessible from '/'
app.use(express.static(path.join(__dirname, 'www')));

// Everything in 'vendor/thoughtbrain' will be "mounted" in '/public'
app.use('/public', express.static(path.join(__dirname, 'vendor/thoughtbrain')));

app.use(express.static(path.join(__dirname, 'views')));

app.all('*', function(req, res){
  res.sendfile('views/view.html')
});

http.createServer(app).listen(8080);