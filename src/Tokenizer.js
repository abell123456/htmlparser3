module.exports = Tokenizer;

var decodeCodePoint = require("entities/lib/decode_codepoint.js"),
    entityMap = require("entities/maps/entities.json"),
    legacyMap = require("entities/maps/legacy.json"),
    xmlMap = require("entities/maps/xml.json"),

    i = 0,

    TEXT = i++,
    BEFORE_TAG_NAME = i++, //after <
    IN_TAG_NAME = i++,
    IN_SELF_CLOSING_TAG = i++,
    BEFORE_CLOSING_TAG_NAME = i++,
    IN_CLOSING_TAG_NAME = i++,
    AFTER_CLOSING_TAG_NAME = i++,

    //attributes
    BEFORE_ATTRIBUTE_NAME = i++,
    IN_ATTRIBUTE_NAME = i++,
    AFTER_ATTRIBUTE_NAME = i++,
    BEFORE_ATTRIBUTE_VALUE = i++,
    IN_ATTRIBUTE_VALUE_DQ = i++, // "
    IN_ATTRIBUTE_VALUE_SQ = i++, // '
    IN_ATTRIBUTE_VALUE_NQ = i++,

    //declarations
    BEFORE_DECLARATION = i++, // !
    IN_DECLARATION = i++,

    //processing instructions
    IN_PROCESSING_INSTRUCTION = i++, // ?

    //comments
    BEFORE_COMMENT = i++,
    IN_COMMENT = i++,
    AFTER_COMMENT_1 = i++,
    AFTER_COMMENT_2 = i++,

    //cdata
    BEFORE_CDATA_1 = i++, // [
    BEFORE_CDATA_2 = i++, // C
    BEFORE_CDATA_3 = i++, // D
    BEFORE_CDATA_4 = i++, // A
    BEFORE_CDATA_5 = i++, // T
    BEFORE_CDATA_6 = i++, // A
    IN_CDATA = i++, // [
    AFTER_CDATA_1 = i++, // ]
    AFTER_CDATA_2 = i++, // ]

    //special tags
    BEFORE_SPECIAL = i++, //S
    BEFORE_SPECIAL_END = i++, //S

    BEFORE_SCRIPT_1 = i++, //C
    BEFORE_SCRIPT_2 = i++, //R
    BEFORE_SCRIPT_3 = i++, //I
    BEFORE_SCRIPT_4 = i++, //P
    BEFORE_SCRIPT_5 = i++, //T
    AFTER_SCRIPT_1 = i++, //C
    AFTER_SCRIPT_2 = i++, //R
    AFTER_SCRIPT_3 = i++, //I
    AFTER_SCRIPT_4 = i++, //P
    AFTER_SCRIPT_5 = i++, //T

    BEFORE_STYLE_1 = i++, //T
    BEFORE_STYLE_2 = i++, //Y
    BEFORE_STYLE_3 = i++, //L
    BEFORE_STYLE_4 = i++, //E
    AFTER_STYLE_1 = i++, //T
    AFTER_STYLE_2 = i++, //Y
    AFTER_STYLE_3 = i++, //L
    AFTER_STYLE_4 = i++, //E

    BEFORE_ENTITY = i++, //&
    BEFORE_NUMERIC_ENTITY = i++, //#
    IN_NAMED_ENTITY = i++,
    IN_NUMERIC_ENTITY = i++,
    IN_HEX_ENTITY = i++, //X

    j = 0,

    SPECIAL_NONE = j++,
    SPECIAL_SCRIPT = j++,
    SPECIAL_STYLE = j++;


function whitespace(c) {
    return c === " " || c === "\n" || c === "\t" || c === "\f" || c === "\r";
}

function characterState(char, SUCCESS) {
    return function(c) {
        if (c === char) this._state = SUCCESS;
    };
}

function ifElseState(upper, SUCCESS, FAILURE) {
    var lower = upper.toLowerCase();

    if (upper === lower) {
        return function(c) {
            if (c === lower) {
                this._state = SUCCESS;
            } else {
                this._state = FAILURE;
                this._index--;
            }
        };
    } else {
        return function(c) {
            if (c === lower || c === upper) {
                this._state = SUCCESS;
            } else {
                this._state = FAILURE;
                this._index--;
            }
        };
    }
}

function consumeSpecialNameChar(upper, NEXT_STATE) {
    var lower = upper.toLowerCase();

    return function(c) {
        if (c === lower || c === upper) {
            this._state = NEXT_STATE;
        } else {
            this._state = IN_TAG_NAME;
            this._index--; //consume the token again
        }
    };
}


var EXPR_START = '{';
var EXPR_END = '}';
var isExprStart = false;

var expr_start_left = 0; //未“抵扣”的左括号数量

// 对文本的处理，支持不解析: '<div></div>'
var lastTextCharacter = '';
var textExprStartNum = 0; // 在text中出现的表达式开始符号数量

function Tokenizer(options, cbs) {
    this._state = TEXT;
    this._buffer = "";
    this._sectionStart = 0;
    this._index = 0;
    this._bufferOffset = 0; //chars removed from _buffer
    this._baseState = TEXT;
    this._special = SPECIAL_NONE;
    this._cbs = cbs;
    this._running = true;
    this._ended = false;
    this._xmlMode = !!(options && options.xmlMode);
    this._decodeEntities = !!(options && options.decodeEntities);
}

Tokenizer.prototype = {
    constructor: Tokenizer,

    // 对文本的处理
    _stateText(c) {
        if(c === EXPR_START && lastTextCharacter !== '\\') {
            textExprStartNum++;
        }

        if(c === EXPR_END && lastTextCharacter !== '\\') {
            textExprStartNum--;
        }

        if (c === "<" && !textExprStartNum) {
            if (this._index > this._sectionStart) {
                this._cbs.ontext(this._getSection());
            }
            this._state = BEFORE_TAG_NAME;
            this._sectionStart = this._index;
        } else if (this._decodeEntities && this._special === SPECIAL_NONE && c === "&") {
            if (this._index > this._sectionStart) {
                this._cbs.ontext(this._getSection());
            }
            this._baseState = TEXT;
            this._state = BEFORE_ENTITY;
            this._sectionStart = this._index;
        }

        lastTextCharacter = c;
    },

    _stateBeforeTagName(c) {
        if (c === "/") {
            this._state = BEFORE_CLOSING_TAG_NAME;
        } else if (c === "<") {
            this._cbs.ontext(this._getSection());
            this._sectionStart = this._index;
        } else if (c === ">" || this._special !== SPECIAL_NONE || whitespace(c)) {
            this._state = TEXT;
        } else if (c === "!") {
            this._state = BEFORE_DECLARATION;
            this._sectionStart = this._index + 1;
        } else if (c === "?") {
            this._state = IN_PROCESSING_INSTRUCTION;
            this._sectionStart = this._index + 1;
        } else {
            this._state = (!this._xmlMode && (c === "s" || c === "S")) ?
                BEFORE_SPECIAL : IN_TAG_NAME;
            this._sectionStart = this._index;
        }
    },

    _stateInTagName(c) {
        if (c === "/" || c === ">" || whitespace(c)) {
            this._emitToken("onopentagname");
            this._state = BEFORE_ATTRIBUTE_NAME;
            this._index--;
        }
    },

    _stateBeforeCloseingTagName(c) {
        if (whitespace(c));
        else if (c === ">") {
            this._state = TEXT;
        } else if (this._special !== SPECIAL_NONE) {
            if (c === "s" || c === "S") {
                this._state = BEFORE_SPECIAL_END;
            } else {
                this._state = TEXT;
                this._index--;
            }
        } else {
            this._state = IN_CLOSING_TAG_NAME;
            this._sectionStart = this._index;
        }
    },

    _stateInCloseingTagName(c) {
        if (c === ">" || whitespace(c)) {
            this._emitToken("onclosetag");
            this._state = AFTER_CLOSING_TAG_NAME;
            this._index--;
        }
    },

    _stateAfterCloseingTagName(c) {
        //skip everything until ">"
        if (c === ">") {
            this._state = TEXT;
            this._sectionStart = this._index + 1;
        }
    },

    _stateBeforeAttributeName(c) {
        if (c === EXPR_START) {
            expr_start_left++;
        }

        if (c === EXPR_END) {
            expr_start_left > 0 && expr_start_left--;
        }

        if (c === ">") {
            this._cbs.onopentagend();
            this._state = TEXT;
            this._sectionStart = this._index + 1;
        } else if (c === "/") {
            this._state = IN_SELF_CLOSING_TAG;
        } else if (!whitespace(c)) {
            this._state = IN_ATTRIBUTE_NAME;
            this._sectionStart = this._index;
        }
    },

    _stateInSelfClosingTag(c) {
        if (c === ">") {
            this._cbs.onselfclosingtag();
            this._state = TEXT;
            this._sectionStart = this._index + 1;
        } else if (!whitespace(c)) {
            this._state = BEFORE_ATTRIBUTE_NAME;
            this._index--;
        }
    },

    // 属性名字
    _stateInAttributeName(c) {
        if (c === EXPR_START) {
            expr_start_left++;
        }

        if (c === EXPR_END) {
            expr_start_left > 0 && expr_start_left--;
        }

        console.log('expr_start_left:', expr_start_left);

        if (c === "=" || c === "/" || c === ">" || (whitespace(c) && expr_start_left === 0)) {
            this._cbs.onattribname(this._getSection());
            this._sectionStart = -1;
            this._state = AFTER_ATTRIBUTE_NAME;
            this._index--;
        }
    },

    _stateAfterAttributeName(c) {
        if (c === "=") { // 以左括号开始的，必须先等右括号闭合
            this._state = BEFORE_ATTRIBUTE_VALUE;
        } else if (c === "/" || c === ">") {
            this._cbs.onattribend(isExprStart);
            this._state = BEFORE_ATTRIBUTE_NAME;
            this._index--;
        } else if (!whitespace(c)) {
            this._cbs.onattribend(isExprStart);
            this._state = IN_ATTRIBUTE_NAME;
            this._sectionStart = this._index;
        }
    },

    // 开始解析attr前
    _stateBeforeAttributeValue(c) {
        isExprStart = c === EXPR_START; // 标识是否是从表达式符号开始解析

        if (isExprStart) {
            expr_start_left++;
        }

        if (c === "\"") {
            this._state = IN_ATTRIBUTE_VALUE_DQ;
            this._sectionStart = this._index + 1;
        } else if (c === "'") {
            this._state = IN_ATTRIBUTE_VALUE_SQ;
            this._sectionStart = this._index + 1;
        } else if (isExprStart) { // 如果是从表达式开始，则进入：双引号、单引号之外的解析步骤里
            this._state = IN_ATTRIBUTE_VALUE_NQ;
            this._sectionStart = this._index; // 注意：保留左边大括号
        } else if (!whitespace(c)) {
            this._state = IN_ATTRIBUTE_VALUE_NQ;
            this._sectionStart = this._index;
            this._index--; //reconsume token
        }
    },

    _stateInAttributeValueDoubleQuotes(c) {
        if (c === "\"") {
            this._emitToken("onattribdata");
            this._cbs.onattribend(isExprStart);
            this._state = BEFORE_ATTRIBUTE_NAME;
        } else if (this._decodeEntities && c === "&") {
            this._emitToken("onattribdata");
            this._baseState = this._state;
            this._state = BEFORE_ENTITY;
            this._sectionStart = this._index;
        }
    },

    _stateInAttributeValueSingleQuotes(c) {
        if (c === "'") {
            this._emitToken("onattribdata");
            this._cbs.onattribend(isExprStart);
            this._state = BEFORE_ATTRIBUTE_NAME;
        } else if (this._decodeEntities && c === "&") {
            this._emitToken("onattribdata");
            this._baseState = this._state;
            this._state = BEFORE_ENTITY;
            this._sectionStart = this._index;
        }
    },

    _stateInAttributeValueNoQuotes(c) {
        if (c === EXPR_START) {
            expr_start_left++;
        }

        if (c === EXPR_END) {
            expr_start_left > 0 && expr_start_left--;
        }

        // 是否跳出表达式继续解析的判断
        if ((whitespace(c) || c === ">" || c === "/") && expr_start_left <= 0) {
            this._emitToken("onattribdata");
            this._cbs.onattribend(isExprStart);
            this._state = BEFORE_ATTRIBUTE_NAME;
            this._index--;
        } else if (this._decodeEntities && c === "&") {
            this._emitToken("onattribdata");
            this._baseState = this._state;
            this._state = BEFORE_ENTITY;
            this._sectionStart = this._index;
        }
    },

    _stateBeforeDeclaration(c) {
        this._state = c === "[" ? BEFORE_CDATA_1 :
            c === "-" ? BEFORE_COMMENT :
            IN_DECLARATION;
    },

    _stateInDeclaration(c) {
        if (c === ">") {
            this._cbs.ondeclaration(this._getSection());
            this._state = TEXT;
            this._sectionStart = this._index + 1;
        }
    },

    _stateInProcessingInstruction(c) {
        if (c === ">") {
            this._cbs.onprocessinginstruction(this._getSection());
            this._state = TEXT;
            this._sectionStart = this._index + 1;
        }
    },

    _stateBeforeComment(c) {
        if (c === "-") {
            this._state = IN_COMMENT;
            this._sectionStart = this._index + 1;
        } else {
            this._state = IN_DECLARATION;
        }
    },

    _stateInComment(c) {
        if (c === "-") this._state = AFTER_COMMENT_1;
    },

    _stateAfterComment1(c) {
        if (c === "-") {
            this._state = AFTER_COMMENT_2;
        } else {
            this._state = IN_COMMENT;
        }
    },

    _stateAfterComment2(c) {
        if (c === ">") {
            //remove 2 trailing chars
            this._cbs.oncomment(this._buffer.substring(this._sectionStart, this._index - 2));
            this._state = TEXT;
            this._sectionStart = this._index + 1;
        } else if (c !== "-") {
            this._state = IN_COMMENT;
        }
        // else: stay in AFTER_COMMENT_2 (`--->`)
    },

    _stateBeforeCdata1: ifElseState("C", BEFORE_CDATA_2, IN_DECLARATION),
    _stateBeforeCdata2: ifElseState("D", BEFORE_CDATA_3, IN_DECLARATION),
    _stateBeforeCdata3: ifElseState("A", BEFORE_CDATA_4, IN_DECLARATION),
    _stateBeforeCdata4: ifElseState("T", BEFORE_CDATA_5, IN_DECLARATION),
    _stateBeforeCdata5: ifElseState("A", BEFORE_CDATA_6, IN_DECLARATION),

    _stateBeforeCdata6(c) {
        if (c === "[") {
            this._state = IN_CDATA;
            this._sectionStart = this._index + 1;
        } else {
            this._state = IN_DECLARATION;
            this._index--;
        }
    },

    _stateInCdata(c) {
        if (c === "]") this._state = AFTER_CDATA_1;
    },

    _stateAfterCdata1: characterState("]", AFTER_CDATA_2),

    _stateAfterCdata2(c) {
        if (c === ">") {
            //remove 2 trailing chars
            this._cbs.oncdata(this._buffer.substring(this._sectionStart, this._index - 2));
            this._state = TEXT;
            this._sectionStart = this._index + 1;
        } else if (c !== "]") {
            this._state = IN_CDATA;
        }
        //else: stay in AFTER_CDATA_2 (`]]]>`)
    },

    _stateBeforeSpecial(c) {
        if (c === "c" || c === "C") {
            this._state = BEFORE_SCRIPT_1;
        } else if (c === "t" || c === "T") {
            this._state = BEFORE_STYLE_1;
        } else {
            this._state = IN_TAG_NAME;
            this._index--; //consume the token again
        }
    },

    _stateBeforeSpecialEnd(c) {
        if (this._special === SPECIAL_SCRIPT && (c === "c" || c === "C")) {
            this._state = AFTER_SCRIPT_1;
        } else if (this._special === SPECIAL_STYLE && (c === "t" || c === "T")) {
            this._state = AFTER_STYLE_1;
        } else {
            this._state = TEXT;
        }
    },

    _stateBeforeScript1: consumeSpecialNameChar("R", BEFORE_SCRIPT_2),
    _stateBeforeScript2: consumeSpecialNameChar("I", BEFORE_SCRIPT_3),
    _stateBeforeScript3: consumeSpecialNameChar("P", BEFORE_SCRIPT_4),
    _stateBeforeScript4: consumeSpecialNameChar("T", BEFORE_SCRIPT_5),

    _stateBeforeScript5(c) {
        if (c === "/" || c === ">" || whitespace(c)) {
            this._special = SPECIAL_SCRIPT;
        }
        this._state = IN_TAG_NAME;
        this._index--; //consume the token again
    },

    _stateAfterScript1: ifElseState("R", AFTER_SCRIPT_2, TEXT),
    _stateAfterScript2: ifElseState("I", AFTER_SCRIPT_3, TEXT),
    _stateAfterScript3: ifElseState("P", AFTER_SCRIPT_4, TEXT),
    _stateAfterScript4: ifElseState("T", AFTER_SCRIPT_5, TEXT),

    _stateAfterScript5(c) {
        if (c === ">" || whitespace(c)) {
            this._special = SPECIAL_NONE;
            this._state = IN_CLOSING_TAG_NAME;
            this._sectionStart = this._index - 6;
            this._index--; //reconsume the token
        } else {
            this._state = TEXT;
        }
    },

    _stateBeforeStyle1: consumeSpecialNameChar("Y", BEFORE_STYLE_2),
    _stateBeforeStyle2: consumeSpecialNameChar("L", BEFORE_STYLE_3),
    _stateBeforeStyle3: consumeSpecialNameChar("E", BEFORE_STYLE_4),

    _stateBeforeStyle4(c) {
        if (c === "/" || c === ">" || whitespace(c)) {
            this._special = SPECIAL_STYLE;
        }
        this._state = IN_TAG_NAME;
        this._index--; //consume the token again
    },

    _stateAfterStyle1: ifElseState("Y", AFTER_STYLE_2, TEXT),
    _stateAfterStyle2: ifElseState("L", AFTER_STYLE_3, TEXT),
    _stateAfterStyle3: ifElseState("E", AFTER_STYLE_4, TEXT),

    _stateAfterStyle4(c) {
        if (c === ">" || whitespace(c)) {
            this._special = SPECIAL_NONE;
            this._state = IN_CLOSING_TAG_NAME;
            this._sectionStart = this._index - 5;
            this._index--; //reconsume the token
        } else {
            this._state = TEXT;
        }
    },

    _stateBeforeEntity: ifElseState("#", BEFORE_NUMERIC_ENTITY, IN_NAMED_ENTITY),
    _stateBeforeNumericEntity: ifElseState("X", IN_HEX_ENTITY, IN_NUMERIC_ENTITY),

    //for entities terminated with a semicolon
    _parseNamedEntityStrict() {
        //offset = 1
        if (this._sectionStart + 1 < this._index) {
            var entity = this._buffer.substring(this._sectionStart + 1, this._index),
                map = this._xmlMode ? xmlMap : entityMap;

            if (map.hasOwnProperty(entity)) {
                this._emitPartial(map[entity]);
                this._sectionStart = this._index + 1;
            }
        }
    },


    //parses legacy entities (without trailing semicolon)
    _parseLegacyEntity() {
        var start = this._sectionStart + 1,
            limit = this._index - start;

        if (limit > 6) limit = 6; //the max length of legacy entities is 6

        while (limit >= 2) { //the min length of legacy entities is 2
            var entity = this._buffer.substr(start, limit);

            if (legacyMap.hasOwnProperty(entity)) {
                this._emitPartial(legacyMap[entity]);
                this._sectionStart += limit + 1;
                return;
            } else {
                limit--;
            }
        }
    },

    _stateInNamedEntity(c) {
        if (c === ";") {
            this._parseNamedEntityStrict();
            if (this._sectionStart + 1 < this._index && !this._xmlMode) {
                this._parseLegacyEntity();
            }
            this._state = this._baseState;
        } else if ((c < "a" || c > "z") && (c < "A" || c > "Z") && (c < "0" || c > "9")) {
            if (this._xmlMode);
            else if (this._sectionStart + 1 === this._index);
            else if (this._baseState !== TEXT) {
                if (c !== "=") {
                    this._parseNamedEntityStrict();
                }
            } else {
                this._parseLegacyEntity();
            }

            this._state = this._baseState;
            this._index--;
        }
    },

    _decodeNumericEntity(offset, base) {
        var sectionStart = this._sectionStart + offset;

        if (sectionStart !== this._index) {
            //parse entity
            var entity = this._buffer.substring(sectionStart, this._index);
            var parsed = parseInt(entity, base);

            this._emitPartial(decodeCodePoint(parsed));
            this._sectionStart = this._index;
        } else {
            this._sectionStart--;
        }

        this._state = this._baseState;
    },

    _stateInNumericEntity(c) {
        if (c === ";") {
            this._decodeNumericEntity(2, 10);
            this._sectionStart++;
        } else if (c < "0" || c > "9") {
            if (!this._xmlMode) {
                this._decodeNumericEntity(2, 10);
            } else {
                this._state = this._baseState;
            }
            this._index--;
        }
    },

    _stateInHexEntity(c) {
        if (c === ";") {
            this._decodeNumericEntity(3, 16);
            this._sectionStart++;
        } else if ((c < "a" || c > "f") && (c < "A" || c > "F") && (c < "0" || c > "9")) {
            if (!this._xmlMode) {
                this._decodeNumericEntity(3, 16);
            } else {
                this._state = this._baseState;
            }
            this._index--;
        }
    },

    _cleanup() {
        if (this._sectionStart < 0) {
            this._buffer = "";
            this._bufferOffset += this._index;
            this._index = 0;
        } else if (this._running) {
            if (this._state === TEXT) {
                if (this._sectionStart !== this._index) {
                    this._cbs.ontext(this._buffer.substr(this._sectionStart));
                }
                this._buffer = "";
                this._bufferOffset += this._index;
                this._index = 0;
            } else if (this._sectionStart === this._index) {
                //the section just started
                this._buffer = "";
                this._bufferOffset += this._index;
                this._index = 0;
            } else {
                //remove everything unnecessary
                this._buffer = this._buffer.substr(this._sectionStart);
                this._index -= this._sectionStart;
                this._bufferOffset += this._sectionStart;
            }

            this._sectionStart = 0;
        }
    },

    //TODO make events conditional
    write(chunk) {
        if (this._ended) this._cbs.onerror(Error(".write() after done!"));

        this._buffer += chunk;
        this._parse();
    },

    _parse() {
        while (this._index < this._buffer.length && this._running) {
            var c = this._buffer.charAt(this._index);
            if (this._state === TEXT) {
                this._stateText(c);
            } else if (this._state === BEFORE_TAG_NAME) {
                this._stateBeforeTagName(c);
            } else if (this._state === IN_TAG_NAME) {
                this._stateInTagName(c);
            } else if (this._state === BEFORE_CLOSING_TAG_NAME) {
                this._stateBeforeCloseingTagName(c);
            } else if (this._state === IN_CLOSING_TAG_NAME) {
                this._stateInCloseingTagName(c);
            } else if (this._state === AFTER_CLOSING_TAG_NAME) {
                this._stateAfterCloseingTagName(c);
            } else if (this._state === IN_SELF_CLOSING_TAG) {
                this._stateInSelfClosingTag(c);
            }

            /*
             *  attributes
             */
            else if (this._state === BEFORE_ATTRIBUTE_NAME) {
                this._stateBeforeAttributeName(c);
            } else if (this._state === IN_ATTRIBUTE_NAME) {
                this._stateInAttributeName(c);
            } else if (this._state === AFTER_ATTRIBUTE_NAME) {
                this._stateAfterAttributeName(c);
            } else if (this._state === BEFORE_ATTRIBUTE_VALUE) {
                this._stateBeforeAttributeValue(c);
            } else if (this._state === IN_ATTRIBUTE_VALUE_DQ) {
                this._stateInAttributeValueDoubleQuotes(c);
            } else if (this._state === IN_ATTRIBUTE_VALUE_SQ) {
                this._stateInAttributeValueSingleQuotes(c);
            } else if (this._state === IN_ATTRIBUTE_VALUE_NQ) {
                this._stateInAttributeValueNoQuotes(c);
            }

            /*
             *  declarations
             */
            else if (this._state === BEFORE_DECLARATION) {
                this._stateBeforeDeclaration(c);
            } else if (this._state === IN_DECLARATION) {
                this._stateInDeclaration(c);
            }

            /*
             *  processing instructions
             */
            else if (this._state === IN_PROCESSING_INSTRUCTION) {
                this._stateInProcessingInstruction(c);
            }

            /*
             *  comments
             */
            else if (this._state === BEFORE_COMMENT) {
                this._stateBeforeComment(c);
            } else if (this._state === IN_COMMENT) {
                this._stateInComment(c);
            } else if (this._state === AFTER_COMMENT_1) {
                this._stateAfterComment1(c);
            } else if (this._state === AFTER_COMMENT_2) {
                this._stateAfterComment2(c);
            }

            /*
             *  cdata
             */
            else if (this._state === BEFORE_CDATA_1) {
                this._stateBeforeCdata1(c);
            } else if (this._state === BEFORE_CDATA_2) {
                this._stateBeforeCdata2(c);
            } else if (this._state === BEFORE_CDATA_3) {
                this._stateBeforeCdata3(c);
            } else if (this._state === BEFORE_CDATA_4) {
                this._stateBeforeCdata4(c);
            } else if (this._state === BEFORE_CDATA_5) {
                this._stateBeforeCdata5(c);
            } else if (this._state === BEFORE_CDATA_6) {
                this._stateBeforeCdata6(c);
            } else if (this._state === IN_CDATA) {
                this._stateInCdata(c);
            } else if (this._state === AFTER_CDATA_1) {
                this._stateAfterCdata1(c);
            } else if (this._state === AFTER_CDATA_2) {
                this._stateAfterCdata2(c);
            }

            /*
             * special tags
             */
            else if (this._state === BEFORE_SPECIAL) {
                this._stateBeforeSpecial(c);
            } else if (this._state === BEFORE_SPECIAL_END) {
                this._stateBeforeSpecialEnd(c);
            }

            /*
             * script
             */
            else if (this._state === BEFORE_SCRIPT_1) {
                this._stateBeforeScript1(c);
            } else if (this._state === BEFORE_SCRIPT_2) {
                this._stateBeforeScript2(c);
            } else if (this._state === BEFORE_SCRIPT_3) {
                this._stateBeforeScript3(c);
            } else if (this._state === BEFORE_SCRIPT_4) {
                this._stateBeforeScript4(c);
            } else if (this._state === BEFORE_SCRIPT_5) {
                this._stateBeforeScript5(c);
            } else if (this._state === AFTER_SCRIPT_1) {
                this._stateAfterScript1(c);
            } else if (this._state === AFTER_SCRIPT_2) {
                this._stateAfterScript2(c);
            } else if (this._state === AFTER_SCRIPT_3) {
                this._stateAfterScript3(c);
            } else if (this._state === AFTER_SCRIPT_4) {
                this._stateAfterScript4(c);
            } else if (this._state === AFTER_SCRIPT_5) {
                this._stateAfterScript5(c);
            }

            /*
             * style
             */
            else if (this._state === BEFORE_STYLE_1) {
                this._stateBeforeStyle1(c);
            } else if (this._state === BEFORE_STYLE_2) {
                this._stateBeforeStyle2(c);
            } else if (this._state === BEFORE_STYLE_3) {
                this._stateBeforeStyle3(c);
            } else if (this._state === BEFORE_STYLE_4) {
                this._stateBeforeStyle4(c);
            } else if (this._state === AFTER_STYLE_1) {
                this._stateAfterStyle1(c);
            } else if (this._state === AFTER_STYLE_2) {
                this._stateAfterStyle2(c);
            } else if (this._state === AFTER_STYLE_3) {
                this._stateAfterStyle3(c);
            } else if (this._state === AFTER_STYLE_4) {
                this._stateAfterStyle4(c);
            }

            /*
             * entities
             */
            else if (this._state === BEFORE_ENTITY) {
                this._stateBeforeEntity(c);
            } else if (this._state === BEFORE_NUMERIC_ENTITY) {
                this._stateBeforeNumericEntity(c);
            } else if (this._state === IN_NAMED_ENTITY) {
                this._stateInNamedEntity(c);
            } else if (this._state === IN_NUMERIC_ENTITY) {
                this._stateInNumericEntity(c);
            } else if (this._state === IN_HEX_ENTITY) {
                this._stateInHexEntity(c);
            } else {
                this._cbs.onerror(Error("unknown _state"), this._state);
            }

            this._index++;
        }

        this._cleanup();
    },

    pause() {
        this._running = false;
    },

    resume() {
        this._running = true;

        if (this._index < this._buffer.length) {
            this._parse();
        }
        if (this._ended) {
            this._finish();
        }
    },

    end(chunk) {
        if (this._ended) this._cbs.onerror(Error(".end() after done!"));
        if (chunk) this.write(chunk);

        this._ended = true;

        if (this._running) this._finish();
    },

    _finish() {
        //if there is remaining data, emit it in a reasonable way
        if (this._sectionStart < this._index) {
            this._handleTrailingData();
        }

        this._cbs.onend();
    },

    _handleTrailingData() {
        var data = this._buffer.substr(this._sectionStart);

        if (this._state === IN_CDATA || this._state === AFTER_CDATA_1 || this._state === AFTER_CDATA_2) {
            this._cbs.oncdata(data);
        } else if (this._state === IN_COMMENT || this._state === AFTER_COMMENT_1 || this._state === AFTER_COMMENT_2) {
            this._cbs.oncomment(data);
        } else if (this._state === IN_NAMED_ENTITY && !this._xmlMode) {
            this._parseLegacyEntity();
            if (this._sectionStart < this._index) {
                this._state = this._baseState;
                this._handleTrailingData();
            }
        } else if (this._state === IN_NUMERIC_ENTITY && !this._xmlMode) {
            this._decodeNumericEntity(2, 10);
            if (this._sectionStart < this._index) {
                this._state = this._baseState;
                this._handleTrailingData();
            }
        } else if (this._state === IN_HEX_ENTITY && !this._xmlMode) {
            this._decodeNumericEntity(3, 16);
            if (this._sectionStart < this._index) {
                this._state = this._baseState;
                this._handleTrailingData();
            }
        } else if (
            this._state !== IN_TAG_NAME &&
            this._state !== BEFORE_ATTRIBUTE_NAME &&
            this._state !== BEFORE_ATTRIBUTE_VALUE &&
            this._state !== AFTER_ATTRIBUTE_NAME &&
            this._state !== IN_ATTRIBUTE_NAME &&
            this._state !== IN_ATTRIBUTE_VALUE_SQ &&
            this._state !== IN_ATTRIBUTE_VALUE_DQ &&
            this._state !== IN_ATTRIBUTE_VALUE_NQ &&
            this._state !== IN_CLOSING_TAG_NAME
        ) {
            this._cbs.ontext(data);
        }
        //else, ignore remaining data
        //TODO add a way to remove current tag
    },

    reset() {
        Tokenizer.call(this, {
            xmlMode: this._xmlMode,
            decodeEntities: this._decodeEntities
        }, this._cbs);
    },

    getAbsoluteIndex() {
        return this._bufferOffset + this._index;
    },

    _getSection() {
        return this._buffer.substring(this._sectionStart, this._index);
    },

    _emitToken(name) {
        this._cbs[name](this._getSection());
        this._sectionStart = -1;
    },

    _emitPartial(value) {
        if (this._baseState !== TEXT) {
            this._cbs.onattribdata(value); //TODO implement the new event
        } else {
            this._cbs.ontext(value);
        }
    },
};
