var rest = require('restler');

const API_ERROR = {
	code: 502,
	message: 'API Error'
};
const DEFAULT_DATE_CODE = 'latest';

const INVALID_DATE_TYPE = {
	message: 'Please provide the date as a string',
	code: 403
};
// Note that these error codes should be HTTP 400 Bad Request
// (or possibly HTTP 422 Unprocessable Entity). 
// HTTP 403 Forbidden is defined for *authorization* failures,
// not request content / validation failures.
// 
// However: the goal of this exercise is to replicate the v001 API,
// which has already defined that HTTP 403 is the validation error condition.
// If a decision is made to fix the v002 API to use proper HTTP error codes,
// then update the error codes in these data structures,
// and retrofit the v001 API to use hard-coded 403s instead for legacy compatibility
const MISSING_BASE = {
	message: 'Please supply a base currency symbol',
	code: 403
};

const MISSING_SYMBOL = {
	message: 'Please supply a currency symbol to convert to',
	code: 403
};

const MISSING_AMOUNT = {
	message: 'Please supply an amount to convert',
	code: 403
};

const NOT_AUTHORIZED = {
	message: 'Not Authorized',
	code: 401
};

function buildResponseData(data, response) {
	return {
		base: data.base,
		amount: data.amount,
		results: self.convertAmount(data.amount, JSON.parse(response.rawEncoded)),
		dated: data.date
	};
}

function getFixerUrl(base, symbols, date) {
	return 'http://api.fixer.io/' + date + '?base=' + base + '&symbols=' + symbols;
}

function isBaseMissing(data) {
	return typeof data.base === 'undefined' || data.base === '';
}

function isSymbolMissing(data) {
	return typeof data.symbol === 'undefined' || data.symbol === '';
}

function isAmountMissing(data) {
	return typeof data.amount === 'undefined' || data.amount === ''
}

function isDateProvided(data) {
	return typeof data.date !== 'undefined';
}

function isDateNotAString(data) {
	return typeof data.date !== 'string';
}

function normalizeBase(data) {
	var base = data.base.toUpperCase();
	return base;
}

function normalizeSymbols(data) {
	var symbols;
	if (typeof data.symbol === 'object') {

		var str = '';
		var symbolArray = data.symbol;

		for (var i = symbolArray.length - 1; i >= 0; i--) {
			str += symbolArray[i].toUpperCase() + ',';
		}

		symbols = str;

	} else {

		symbols = data.symbol.toUpperCase();

	}
	return symbols;
}

// A convention I like to use is to have any method that returns a Promise
// to be prefixed with "promise". When interpreted as a verb, this function
// means "I promise to return a symbol, or a reason why I can't".
//
// Alternately: when using TypeScript, you can explicitly specify the return 
// type in the function declaration, making this sort of prefixing unnecessary.
// 
// Alternately: use async/await in ES7
function promiseBase(requestData) {
	if (isBaseMissing(requestData)) {
		return Promise.reject(MISSING_BASE);
	}
	var base = normalizeBase(requestData);
	return Promise.resolve(base)
}

function promiseDate(requestData) {
	if (!isDateProvided(requestData)) {
		return Promise.resolve(DEFAULT_DATE_CODE);
	}
	if (isDateNotAString(requestData)) {
		return Promise.reject(INVALID_DATE_TYPE);
	}
	return Promise.resolve(requestData.date);
}

function promiseSymbol(requestData) {
	if (isSymbolMissing(requestData)) {
		return Promise.reject(MISSING_SYMBOL);
	}
	var symbol = normalizeSymbols(requestData);
	return Promise.resolve(symbol)
}

// Note that v001 passed normalized data to Fixer but
// then used the original request data in the response data.
// v002 preserves this.
function promiseFixer(requestData, base, symbols, date) {
	return new Promise((resolve, reject) => {
		const url = getFixerUrl(base, symbols, date);

		rest.get(url).on('complete', (error, response) => {
			if (response.statusCode === 200) {
				const responseData = buildResponseData(requestData, response);
				resolve(responseData);
				return;
			}
			if (response.statusCode == NOT_AUTHORIZED.code) {
				reject(NOT_AUTHORIZED);
				return;
			}
			if (response.statusCode == API_ERROR.code) {
				reject(API_ERROR);
				return;
			}
			reject({
				code: 500,
				message: "Unknown API status code"
			})
			return;
		});
	});
}

var self = module.exports = {

	ver001: (data, res, callback) => {

		if (isBaseMissing(data)) {
			self.sendResponse(res, MISSING_BASE.code, MISSING_BASE.message);
			return;
		}

		const base = normalizeBase(data);

		// var url = 'https://api.fixer.io/latest?symbols=' + data.symbol.from + ',' + data.symbol.to;

		if (isSymbolMissing(data)) {
			self.sendResponse(res, MISSING_SYMBOL.code, MISSING_SYMBOL.message);
			return;
		}

		if (isAmountMissing(data)) {
			self.sendResponse(res, MISSING_AMOUNT.code, MISSING_AMOUNT.message);
			return;
		}

		const symbols = normalizeSymbols(data);
		var date;
		if (isDateProvided(data)) {
			if (isDateNotAString(data)) {
				self.sendResponse(res, INVALID_DATE_TYPE.code, INVALID_DATE_TYPE.message);
				return;
			}
			date = data.date;
		} else {
			date = DEFAULT_DATE_CODE;
		}


		var url = getFixerUrl(base, symbols, date);

		rest.get(url).on('complete', function (err, response) {

			if (response.statusCode == 200) {
				var returns = buildResponseData(data, response);
				self.sendResponse(res, 200, returns);
			}
			if (response.statusCode == NOT_AUTHORIZED.code) {
				callback(NOT_AUTHORIZED.message);
			}
			if (response.statusCode == API_ERROR.code) {
				callback(API_ERROR.message);
			}

		});

	},

	v002: (requestData, response) => {
		const basePromise = promiseBase(requestData);
		const symbolPromise = promiseSymbol(requestData);
		const datePromise = promiseDate(requestData);

		Promise.all([basePromise, symbolPromise, datePromise]).then(([base, symbols, date]) => {
			return promiseFixer(base, symbols, date).then((responseData) => {
				self.sendResponse(response, 200, responseData);
			});
		}).catch((error) => {
			if (error.code && error.message) {
				self.sendResponse(response, error.code, error.message);
				return;
			}
			self.sendResponse(response, 500, "Unknown error");
		});
	},

	convertAmount: (amount, data) => {

		var rates = data.rates;
		var returns = [];

		for (var r in rates) {

			if (rates.hasOwnProperty(r)) {

				var convert = (amount * rates[r]);
				returns.push({ from: data.base, to: r, roundedResult: convert.toFixed(2), fullResult: convert, rate: rates[r] })

			}

		}

		return returns;
	},

	sendResponse: (res, status, response) => {

		if (typeof response === 'object') {
			response = JSON.stringify(response);
		}
		res.status(status);
		res.write(response);
		res.end();
		return

	}
}