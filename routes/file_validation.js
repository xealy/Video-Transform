var express = require('express');
var router = express.Router();

router.get('/', async function(req, res, next) {
  res.render('validation', { title: 'Video Transform', message: 'This file is not in MP4 format. Please provide an MP4 file.' });
});

module.exports = router;
