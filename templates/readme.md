# Expose and Require
Adds "module.exports" to a file, exposing:

- globally defined variables (either with `const`, `let` or `var`);
- globally declared functions with "function" keyword;
- classes declared with `class` keyword (including child classes with `extends`);

Updated file is then saved to the target path and `require`d.
If target or source path does not exist or the file can't be read or 
written, the module will attempt to resolve the issues.

**WARNING** The module is asynchronous, use `async` / `await` or promises to avoid race conditions.

## Basic usage

`exposeAndRequire` function accepts three parameters:

1. Path to the source file **(required)**
2. Path to the target folder
3. Options object, specifying actions / additional parameters:
  - <a id="color"></a>`color` colorize log output (using color escape sequences)
  - `exposeOnly` forces module to return `null` and do not `require` exposed file
  - `grep` each line will be matched against and performed replacements on accordingly
  - <a id="log">`log`</a> redirects logging output of the module (see [logging](#logging) ):
    - to a file if path is given
    - to a stream if given a `Stream`
  - `require` output file will be prepended with `require` statements
  - <a id="use"></a>`use` root to resolve against for required modules, can be either:
    - `root` paths are relative to `"."` **default**
    - `cwd` paths are relative to `process.cwd()` **dynamic**
    - `module` paths are relative to module folder

```node.js
const ER = require('expose-require');

ER
    .exposeAndRequire('lib/index.js','test',{
        require: {
            'fs': 'fs',
            '{ someFunc }': 'someModule'
        },
        grep: [{
            match: /(\d+)/,
            replace: '$1$1'
        }],
        use: "module"
    })
    .then(module => {
        //do stuff;
    });

```

### Usage with source path only

You can omit both the target path and opions, in which case the file will be created in the `root` directory (passing an empty string as the second agrument results is treated the same way):

````node.js
const { exposeAndRequire } = require('expose-require');

//inside async function
const someModule = await exposeAndRequire('test/test.js');

//with empty string
const yummy = await exposeAndRequire('dinner/steak.js','');

//do stuff;

````

### Exposing classes

Given a class or a child class declaration,
the module will add it to the current `module.exports`.

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
module.exports = exports = {
	BaseClassLine,
	BaseClass,
	BaseClassTabbed,
	BaseClassSpaced,
	ChildClassLine,
	ChildClass
};
````

### Exposing global variables

Given a variable declared in a global scope,
the module will add it to `module.exports` regardless of keyword used: `const`, `let`, or `var`.

````node.js
const constVar = () => console.warn('Be warned!');

let letVar = function () {
    const rand = Math.floor(Math.random() * 2);

    const mood = new Map()
        .set(0, () => 'Sometimes I feel blue')
        .set(1, () => 'But other times I cheer!');

    return mood.get(rand);
};

var varVar = 42;
````

exposes:
````node.js
module.exports = exports = {
	constVar,
	letVar,
	varVar
};
````

### Nested declarations

As of 1.3.0 the module ignores nested declarations. For example, given a source file:

````node.js
const functionWithNestedFuncions = function () {

    function nested() {
        const inner = 'This should be unreachable';
    }

}
````
its `module.exports` will not expose `nested` function or `inner` variable:

````node.js
module.exports = exports = {
	functionWithNestedFuncions
};
````

### Overriding `require` sources

To require a module without relation to *target path*, you can prefix the path with `[relation]::`,
where `relation` is one of the [`use`](#use) option values. 

In the example below, without `root::`, path to required `coolModule` would be resolved as `[module folder]/mocks/coolModule.js`, instead, it is resolved as `[project root]/coolModule.js`:
````node.js
const awesomeModule = await exposeAndRequire('pathToModule','mocks',{
    require: {
        "{ doCool }" : "root::coolModule.js"
    },
    use: "module"
});
````

## Caching

Since Node.js caches modules in `require.cache` object, right before the exposed module is required, module cache is cleared (only the exposed entry will be deleted) to ensure the module is reloaded.

*Side note*: although the module will clear output cache, make sure you clear parent module cache if *watching* source files for changes.

## Fallbacks

If any path in exposure lifecycle does not exist, it will be created. If a folder is missing, it will be created *recursively*. If a file is missing, it will be created, as well as any folder not existing in path (even if this is a source file).

## Logging<a id="logging"></a>

By default, the module outputs status messages on `stdout` using `chalk`. If you intend to save or process logs, remember to remove colour escape sequences.

[RESOLVED] Created source: mocks/no-such-file.js success

[EXPOSED] test/source/tested.js => test/mocks

[FAILED] Could not process file

The module can redirect logging output for you if you need to export to a file or send to logging service (see [`log`](#log) and [`color`](#color) options).

## Versions

Current version is ${version}

<table>
    <thead>
        <tr>
            <th>Version</th>
            <th>Features</th>
            <th>Squashed 🐞</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>1.0.0</td>
            <td>Initial feature set</td>
            <td>-</td>
        </tr>
        <tr>
            <td>1.1.0</td>
            <td>Added "mute", "log" and "color" options</td>
            <td>Output folder location issues</td>
        </tr>
         <tr>
            <td>1.2.0</td>
            <td>Added module cache clearing</td>
            <td>Folders with spaces escaping</td>
        </tr>
        <tr>
            <td>1.3.0</td>
            <td>Nested declarations are ignored</td>
            <td>-</td>
        </tr>
        <tr>
            <td>1.3.3</td>
            <td>-</td>
            <td>Edge case of "} else if {}" correctly decreases nestedness</td>
        </tr>
        ${description}
    </tbody>
</table>

 
