var express = require('express');
var router = express.Router();

var bodyParser = require('body-parser'),
    jsonParser = bodyParser.json(),
    api = require('../api');

// middleware that is specific to this router
router.use(function (req, res, next) {
	next();
});

// Note: these API calls should be functioning on GETs, not 
// POSTs, as they are idempotent. The reason for GETs is strictly 
// because the request data is coming in via a JSON request body
// not query string parameters. 
// TODO: implement a GET API that checks for query string params
router.get('/0.1', jsonParser, function(req, res){
    res.status(404).send('This route is not available');
    res.end();
});

router.post('/0.1/', jsonParser, function(req, res){
    api.ver001(req.body, res, (errorMessage)=>{
		res.status(500).send("An internal server error occurred: " + errorMessage);
	});
});

router.post('/0.2/', jsonParser, function(request, response){
    api.ver002(request.body, response);
});

module.exports = router;