var parser = require('../../');
var fs = require('fs');
var html = fs.readFileSync('./index.html', 'utf8');

var ast = parser.parseDOM(html, {
    xmlMode: true
});


// console.log('ast:', ast);

// console.log(ast[0]);
ast[0].children.forEach(item => {
    // console.log(item);
});

printAttrs(ast);

// console.log('attr:', ast[0].attribs);

function printAttrs(ast) {
    if(Array.isArray(ast)) {
        ast.forEach(item => {
            printAttrs(item);
        });
    } else {
        if(ast.attribs) {
            Object.keys(ast.attribs).forEach(key => {
                let attr = ast.attribs[key];

                console.log('map:', key);
                console.log('attr:', attr);
            });
        }

        if(ast.children && ast.children.length) {
            ast.children.forEach(child => {
                printAttrs(child);
            });
        }
    }
}
