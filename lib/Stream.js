"use strict";

var _keys = require("babel-runtime/core-js/object/keys");

var _keys2 = _interopRequireDefault(_keys);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

module.exports = Stream;

var Parser = require("./WritableStream.js");

function Stream(options) {
	Parser.call(this, new Cbs(this), options);
}

require("inherits")(Stream, Parser);

Stream.prototype.readable = true;

function Cbs(scope) {
	this.scope = scope;
}

var EVENTS = require("../").EVENTS;

(0, _keys2.default)(EVENTS).forEach(function (name) {
	if (EVENTS[name] === 0) {
		Cbs.prototype["on" + name] = function () {
			this.scope.emit(name);
		};
	} else if (EVENTS[name] === 1) {
		Cbs.prototype["on" + name] = function (a) {
			this.scope.emit(name, a);
		};
	} else if (EVENTS[name] === 2) {
		Cbs.prototype["on" + name] = function (a, b) {
			this.scope.emit(name, a, b);
		};
	} else {
		throw Error("wrong number of arguments!");
	}
});