"use strict";

var _keys = require("babel-runtime/core-js/object/keys");

var _keys2 = _interopRequireDefault(_keys);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

module.exports = ProxyHandler;

function ProxyHandler(cbs) {
	this._cbs = cbs || {};
}

var EVENTS = require("./").EVENTS;

(0, _keys2.default)(EVENTS).forEach(function (name) {
	if (EVENTS[name] === 0) {
		name = "on" + name;
		ProxyHandler.prototype[name] = function () {
			if (this._cbs[name]) this._cbs[name]();
		};
	} else if (EVENTS[name] === 1) {
		name = "on" + name;
		ProxyHandler.prototype[name] = function (a) {
			if (this._cbs[name]) this._cbs[name](a);
		};
	} else if (EVENTS[name] === 2) {
		name = "on" + name;
		ProxyHandler.prototype[name] = function (a, b) {
			if (this._cbs[name]) this._cbs[name](a, b);
		};
	} else {
		throw Error("wrong number of arguments");
	}
});