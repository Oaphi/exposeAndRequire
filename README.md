# Expose and Require
Adds "module.exports" to a file, exposing:

- globally defined variables (either with const, let or var);
- globally declared functions with "function" keyword;
- classes declared with "class" keyword (including child classes with "extends");

Updated file is then saved to the specified folder and required as a module.

## Basic usage

`exposeAndRequire` function accepts three parameters:

1. Path to the source file **(required)**
2. Path to the target folder **(required)**
3. Options object, specifying actions:
  - `grep` each line will be matched against and performed replacements on accordingly
  - `require` output file will be prepended with `require` statements

```node.js
const ER = require('expose-require');

ER.exposeAndRequire('./lib/index.js','./test',{
    require: {
        'fs': 'fs'
    },
    grep: [{
        match: /(\d+)/,
        replace: '$1$1'
    }],
    use: "module"
});

```

### Exposing classes

Given a class or a child class declaration,
the utility will add it to the current `module.exports`.
*Note that in-scope declarations will be exposed as well*

```node.js
class BaseClassLine {}
class BaseClass {
    constructor() {

    }
}
    //tabulated declaration
	class BaseClassTabbed {
        constructor() {
            
        }
    }

    //spaced declaration
    class BaseClassSpaced {
        constructor() {

        }
    }

class ChildClassLine extends BaseClass {}
class ChildClass extends BaseClass {
    constructor() {
        
    }
}
```
exposes:
````node.js
module.exports = {
	BaseClassLine,
	BaseClass,
	BaseClassTabbed,
	BaseClassSpaced,
	ChildClassLine,
	ChildClass
};
````