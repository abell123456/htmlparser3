# htmlparser3

基于[htmlparser2](https://www.npmjs.com/package/htmlparser2)的HTML AST解析定制(``实现更改` & `功能添加`)实现。


## 新特性

- [x] 支持`JSX {}`格式的表达式定义；    
- [x] 使用自定制`domhandler3`替换默认`domhandler`，支持更多方便的钩子函数及功能定制；    
- [x] 属性部分由原来的对象格式转变为：`数组`，并增添是否是表达式的判断属性；  
- [x] 表达式解析优化，支持:`{alert(0)}{console.log(1)}`两个标签并列书写，支持：`{'<div>hello world<div>'}`；
