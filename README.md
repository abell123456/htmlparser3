# htmlparser3

基于[htmlparser2](https://www.npmjs.com/package/htmlparser2)的HTML AST解析定制(``实现更改` & `功能添加`)实现。


## 新特性

- [x] 支持`JSX {}`格式的表达式定义；    
- [x] 使用自定制`domhandler3`替换默认`domhandler`，支持更多方便的钩子函数及功能定制；    
- [x] 属性部分由原来的对象格式转变为：`数组`，并增添是否是表达式的判断属性；  
- [x] 表达式解析优化，支持:`{alert(0)}{console.log(1)}`两个标签并列书写，支持：`{'<div>hello world<div>'}`；


## example

parse with Node.js: https://github.com/abell123456/htmlparser3/tree/master/demo/build-with-node     
parse with React.js: https://github.com/abell123456/htmlparser3/tree/master/demo/react-parser   

## DEMO 

```js
const html = `
<Switch condition={"5"}>
    <div>555</div>
    <Case is={a>b} />
        <span>111</span>
    <Case is="2" />
        <span>222</span>
    <Default/>
        <span>I am showed now!</span>
</Switch>
`;

var parser = require('htmlparser3');
var fs = require('fs');

var ast = parser.parseDOM(html, {
    xmlMode: true
});


console.log('ast[0]:', ast[0]); // AST

ast[0].children.forEach(item => {
    console.log(item);
});

printAttrs(ast[0]);

// console.log('attr:', ast[0].attribs);


function printAttrs(ast) {
    if(ast.attrs && ast.attrs.length) {
        ast.attrs.forEach(attr => {
            console.log('attr:', attr);
        });
    }

    if(ast.children && ast.children.length) {
        ast.children.forEach(child => {
            printAttrs(child);
        });
    }
}
```
