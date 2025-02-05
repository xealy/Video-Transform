var express = require('express');
var router = express.Router();

router.get('/', async function(req, res, next) {
  res.render('validation', { title: 'Video Transform', message: 'You have not uploaded any files. Please provide an MP4 file.' });
});

module.exports = router;
