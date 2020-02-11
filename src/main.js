const fs = require('fs');
const rl = require('readline');
const util = require('util');
const pt = require('path');

/**
 * @typedef {Object} RequireGREP
 * @type {Object.<RegExp, String>}
 * @property {RegExp} match
 * @property {String} replace
 */

/**
 * @typedef {Object} RequireModules
 * @type {Object.<String, String>}
 * @property {String} use
 */

/**
 * Map of directory options to 
 * resolve against when requiring
 * and making outputs
 * @enum {String}
 * @property {String} cwd resolve against process cwd
 * @property {String} module resolve against module root
 * TODO add project root option
 */
const dirMap = new Map();
dirMap.set('cwd', process.cwd());
dirMap.set('module', __dirname);


/**
 * Creates readline interface from path 
 * for reading files line by line
 * @param {String} path valid path 
 * @returns {Interface} readline interface
 */
const readlineFromPath = (path) => {
    const read = fs.createReadStream(path);
    return rl.createInterface(read);
};

/**
 * Counts number bytes in first N lines of a file
 * @param {String} path valid path
 * @param {Number=} lines lines to count
 * @returns {Number} bytes in lines
 */
const getLineBytes = async (path, lines) => {
    let numberOfBytes = 0;
    let currentLineNumber = 1;

    const interface = readlineFromPath(path);
    for await (const line of interface) {
        (!lines || currentLineNumber > lines) ||
            (numberOfBytes += Buffer.byteLength(line) + 1);
        currentLineNumber++;
    }

    return numberOfBytes;
};

/**
 * Resolves path to use when inserting "require"
 * @param {String} from path from which to resolve 
 * @param {String} to path to which to resolve
 * @param {String} use directory to resolve against
 * @returns {String} resolved path
 */
const relPath = (from, to, use) => {
    const useMap = new Map();
    useMap.set('cwd', process.cwd());
    useMap.set('module', __dirname);

    const choice = useMap.get(use);

    const path = pt
        .resolve(choice, from, to)
        .replace(/\\/g, '/');

    return path;
};

/**
 * 
 * @param {String} path 
 * @param {String} destination
 * @param {WritableStream} stream 
 * @param {RequireGREP[]} grep
 * @param {RequireModules} require
 * @param {String} use
 * @returns {WritableStream}
 */
const expose = async (path, destination, stream, grep = [], require = {}, use = 'module') => {
    const write = util.promisify(stream.write).bind(stream);

    const includedModules = Object.keys(require)
        .map(key => `${key !== '' ? `const ${key} = ` : ''}require("${
            /[^\w-]/.test(require[key]) ?
                relPath(destination, require[key], use) :
                require[key]
            }");`);

    includedModules.length && await write(`${includedModules.join('\n')}\n\n`);

    const IF = readlineFromPath(path);

    const exports = [];

    const processLine = async (line) => {
        const classRegExp = /^(?:\t|\s)*class\s+(\w+)(?:\s+extends\s+\w+)*\s*\{/;
        const funcRegExp = /^(?:async\s)*function\s+(\w+)\s*(?:\{|\()/;
        const globalVarRegExp = /^(?:var|const|let)(?=\s+([\w-]+)(?:(?:\s+\=\s+)|$))/;

        const [full, name] =
            line.match(classRegExp) ||
            line.match(funcRegExp) ||
            line.match(globalVarRegExp) ||
            [line];

        name && exports.push(name);

        //replace strings matchign greps;
        const changed = grep.reduce((acc, config) => acc.replace(config.match, config.replace), line);
        await write(`${changed}\n`);
    };

    for await (const line of IF) {
        processLine(line);
    }

    const moduleExports = `{\n${exports
        .map(l => '\t' + l)
        .join(',\n')}\n};`;

    await write('\nmodule.exports = ' + moduleExports);

    return stream;
}

/**
 * 1. Exposes file's globally defined classes and functions to module.exports
 * 2. Exports file as Common.js module in the folder specified
 * 3. Requires the file for use
 * @param {String} path path to source file
 * @param {String} folderPath path to destination folder
 * @param {Object} options configuration object
 * @param {RequireGREP[]} options.grep update lines matching regex
 * @param {RequireModules} options.require include specified modules
 * @param {Number} options.skip lines to skip when writing
 * @param {String} options.use which folder to relate to
 * @returns {*} required module content
 */
const exposeAndRequire = async (path, folderPath, options = {}) => {
    const filePath = pt.parse(path);

    const destinationPath = pt.resolve(folderPath, filePath.base);

    const existing = fs.existsSync(destinationPath);

    if (!existing) {
        fs.mkdirSync(folderPath, { recursive: true });
    }

    const skipBytes = existing ? await getLineBytes(destinationPath, options.skip) : 0;

    const writeable = fs.createWriteStream(destinationPath, {
        start: skipBytes, flags: existing && skipBytes ? 'r+' : 'w'
    });

    await expose(path, folderPath, writeable, options.grep, options.require, options.use);

    return require(`${destinationPath}`);
};

module.exports = {
    exposeAndRequire
};
