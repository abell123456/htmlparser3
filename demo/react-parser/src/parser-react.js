import parser from '../../../lib';
var React;

// 解析成两个React Components
function parse(html, R, scope) {
    React = R;

    const ast = parseHtmlToObj(html);

    console.log('ast:', ast[0]);

    window.__scope = scope;

    return traverseToReact(ast, scope);
}

function traverseToReact(obj, scope) {

    console.log('obj:', obj);

    if (Array.isArray(obj)) {
        obj = obj[0];
    }

    var type = obj.type,
        tagName = obj.name,
        children = obj.children,
        comp,
        tagArray = [tagName];

    if (type == 'tag') {
        // 标签类型，调用React.createElement创建元素
        comp = React.createElement.apply(
            null,
            tagArray
            .concat(buildArgs(obj.attribs, scope))
            .concat(children.map(traverseToReact)) // 递归处理
        );
    } else if (type == 'text') {
        comp = obj.data;
    }

    return comp;
}

// 参数
function buildArgs(attrs, scope) {
    if (isEmptyObject(attrs)) {
        return null;
    }

    var item,
        key,
        val,
        attribObj = {},
        regularKeys = /(data-||aria-)?/;

    for (var i = 0, len = attrs.length; i < len; i++) {
        item = attrs[i];

        // 属性名字
        key = item.name;
        val = item.value;

        console.log(key, val);

        if (key == 'class') {
            attribObj.className = val;
        } else if (key == 'style') {
            attribObj.style = parseStyle(val.split(';'));
        } else if (key.match(regularKeys)[1]) {
            attribObj[key] = val;
        } else if (key == 'for') {
            attribObj.htmlFor = val;
        } else if(isEvent(key)){
            attribObj[key] = new Function('scope', `
                ${getScopeVars()}
                (${item.expression})();
            `);
        } else{
            attribObj[camelCase(key)] = val;
        }

    }

    console.log('attribObj:', attribObj);

    return attribObj;
}

function getScopeVars() {
    let str = ``;

    return Object.keys(window.__scope).map(key => {
        return `
            var ${key} = window.__scope.${key};
        `;
    }).join('');
}

function isEmptyObject(obj) {
    return Object.getOwnPropertyNames(obj).length === 0;
}

function parseStyle(styles) {
    var styleObj = {},
        styleSplit;
    if (!styles.length || !Array.isArray(styles)) {
        return {};
    }

    styles.forEach(function(style) {
        if (!style) {
            return;
        }

        styleSplit = style.split(':');
        styleObj[camelCase(styleSplit[0])] = styleSplit[1];
    });

    return styleObj;
}

function isEvent(name) {
    return name.startsWith('on');
}

function camelCase(input) {
    return input.toLowerCase().replace(/-(.)/g, function(match, group1) {
        return group1.toUpperCase();
    });
}

function parseHtmlToObj(html) {
    return parser.parseDOM(html, {
        xmlMode: true
    });
}

module.exports = parse;
