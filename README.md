# Expose and Require
Adds "module.exports" to a file, exposing:

- globally defined variables (either with const, let or var);
- globally declared functions with "function" keyword;
- classes declared with "class" keyword (including child classes with "extends");

Updated file is then saved to the target path and `require`d.
If target path or file do not exist or the file can't be read or 
written, the module will attempt to create the path and (or) change 
target file's permissions.

**WARNING** The module is asynchronous, use `await` or promises to avoid race conditions.

## Basic usage

`exposeAndRequire` function accepts three parameters:

1. Path to the source path **(required)**
2. Path to the target path
3. Options object, specifying actions / additional parameters:
  - <a id="color"></a>`color` colorize output (using color escape sequences)
  - `grep` each line will be matched against and performed replacements on accordingly
  - <a id="log">`log`</a> redirects logging output of the module:
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

You can omit both the target path and opions, in which case the 
file will be created in the `root` directory:

````node.js
const { exposeAndRequire } = require('expose-require');

//inside async function
const someModule = await exposeAndRequire('test/test.js');

//do stuff;

````

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

### Logging

By default, the module outputs status messages on `stdout` using `chalk`. If you intend to save or process logs, remember to remove colour escape sequences.

<font color="green">[RESOLVED] Created source: mocks/no-such-file.js success</font>
<font color="green">[EXPOSED] test/source/tested.js => test/mocks</font>
<font color="red">[FAILED] Could not process file</font>

The module can redirect logging output for you if you need to export to a file or send to logging service (see [`log`](#log) and [`color`](#color) options).

### Versions

<table>
    <thead>
        <tr>
            <th>Version</th>
            <th>Features</th>
            <th>Fixes</th>
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
            <td>Squashed folder creation bugs</td>
        </tr>
    </tbody>
</table>

 
