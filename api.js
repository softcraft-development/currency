var rest = require('restler');


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

const INVALID_DATE_TYPE = {
	message: 'Please provide the date as a string',
	code: 403
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

function isDateAString(data) {
	return typeof data.date !== 'string';
}

function normalizeDate(data) {
	var base = data.base.toUpperCase();
	return base;
}

function normalizeDate(data, onError) {
	var date;
	if (typeof data.date !== 'undefined') {
		if (isDateAString(data)) {
			onError();
			return;
		}
		date = data.date;
	} else {
		date = 'latest';
	}
	return date;
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
		const date = normalizeDate(data, () => {
			self.sendResponse(res, INVALID_DATE_TYPE.code, INVALID_DATE_TYPE.message);
		});

		var url = 'http://api.fixer.io/' + date + '?base=' + base + '&symbols=' + symbols;

		rest.get(url).on('complete', function (err, response) {

			if (response.statusCode == 200) {

				var returns = {
					base: data.base,
					amount: data.amount,
					results: self.convertAmount(data.amount, JSON.parse(response.rawEncoded)),
					dated: data.date
				};

				self.sendResponse(res, 200, returns);
			}
			if (response.statusCode == 401) {
				callback('Not Authorized');
			}
			if (response.statusCode == 502) {
				callback('API Error');
			}

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