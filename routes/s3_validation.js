var express = require('express');
var router = express.Router();

router.get('/', async function(req, res, next) {
  res.render('validation', { title: 'Video Transform', message: 'Already existing file with this name. Please rename this file.'});
});

module.exports = router;
