# Expose and Require
Adds "module.exports" to a file, exposing:

- globally defined variables (either with const, let or var);
- globally declared functions with "function" keyword;
- classes declared with "class" keyword;

Updated file is then saved to the specified folder and required as a module.

## Basic usage

`exposeAndRequire` function accepts three parameters:

1. Path to the source file **required**
2. Path to the target folder **required**
3. Options object, specifying actions:
  - `grep` each line will be matched against and performed replacements on accordingly
  - `require` output file will be prepended with `require` statements

```
const ER = require('expose-require');

ER.exposeAndRequire('./lib/index.js','./test',{
    require: {
        'fs': 'fs'
    },
    grep: [{
        match: /(\d+)/,
        replace: '$1$1'
    }]
});

```