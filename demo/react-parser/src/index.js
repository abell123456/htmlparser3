import ReactDOM from 'react-dom';
import React from 'react';
import reactParser from './parser-react';

import html from './template';

const rawHtml = html.trim();

var parsedComponent = reactParser(rawHtml, React, {
    func: function(arg) {
        alert(arg || 1);
    }
});

ReactDOM.render(
    parsedComponent,
    document.getElementById('root') // 对外
);
