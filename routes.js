// eslint-disable-next-line no-unused-vars
module.exports = function (app, passport, express) {

	//Routing files
	var api = require('./routes/api.js');
	var front = require('./routes/front.js');

	//Routing functions
	//
	app.use('/api', api)
		.use('/', front)

	// Handle 404
	// eslint-disable-next-line no-unused-vars
	app.use(function (req, res, next) {
		res.status(404).send('<h1>ERROR 404:</h1>Page not found! OOPS!');
	});

	// Handle 500
	// eslint-disable-next-line no-unused-vars
	app.use(function (error, req, res, next) {
		res.status(500).send('<h1>ERROR 500:</h1>Error loading services<br />' + error + '<br />' + error.stack);
	});


};

