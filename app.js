var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
const responseTime = require('response-time')

var indexRouter = require('./routes/index');
var videoEncodeRouter = require('./routes/video_encode');
var s3ValidationRouter = require('./routes/s3_validation');
var noFileValidationRouter = require('./routes/no_file_validation');
var fileValidationRouter = require('./routes/file_validation');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'hbs');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// ALEX ADDED THIS (express static)
app.use(express.static("public")); // Serve static files
app.use('/uploads', express.static('uploads'));
app.use('/downloads', express.static('downloads'));
app.use(responseTime()); // Used to display response time in HTTP header

app.use('/', indexRouter);
app.use('/video_encode', videoEncodeRouter);
app.use('/s3_validation', s3ValidationRouter);
app.use('/no_file_validation', noFileValidationRouter);
app.use('/file_validation', fileValidationRouter);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
