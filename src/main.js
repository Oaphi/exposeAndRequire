const fs = require('fs');
const rl = require('readline');
const util = require('util');
const pt = require('path');

const { validatePath, validateFilePath } = require('./validator.js');
const { clearCached, dirMap, isBalanced } = require('./utils.js');
const Controller = require('./control.js');

/**
 * @typedef RequireGREP
 * @property {RegExp} match
 * @property {String} replace
 */

/**
 * @typedef RequireModules
 */

/**
 * @typedef {object} ExposeRequireOptions
 * @property {boolean} [color=true] colorize logging output 
 * @property {RequireGREP[]} [grep] update lines matching regex
 * @property {NodeJS.WritableStream|string} [log] output redirect
 * @property {boolean} [mute] mutes logging output
 * @property {number} [skip] lines to skip when writing
 * @property {string} [use] which folder to relate to
 * @property {RequireModules} [require] include specified modules
 */

/**
 * Creates readline interface from path 
 * for reading files line by line
 * @param {string} path valid path 
 * @returns {Interface}
 */
const readlineFromPath = (path) => {
    const read = fs.createReadStream(path, { flags: 'a+' });
    return rl.createInterface(read);
};

/**
 * Counts number bytes in first N lines of a file
 * @param {string} path valid path
 * @param {number} [lines] lines to count
 * @returns {Promise} bytes in lines
 */
const getLineBytes = async (path, lines = 0) => {
    let numberOfBytes = 0;
    let currentLineNumber = 1;

    const iter = readlineFromPath(path);

    for await (const line of iter) {
        (!lines || currentLineNumber > lines) ||
            (numberOfBytes += Buffer.byteLength(line) + 1);
        currentLineNumber++;
    }

    iter.close();

    return numberOfBytes;
};

/**
 * Resolves path to use when inserting "require"
 * @param {string} from path from which to resolve
 * @param {string} to path to which to resolve
 * @param {string} use directory to resolve against
 * @returns {string} resolved path
 */
const relPath = (from, to) => (use) => {
    const choice = dirMap.get(use);

    const path = pt
        .resolve(choice, from, to)
        .replace(/\\/g, '/');

    return path;
};

/**
 * 
 * @param {function} write 
 * @param {string} line 
 * @param {RequireGREP[]} grep 
 * @param {RequireModules} exportsObj 
 * @param {number} [nested]
 */
const processLine = async (write, line, grep, exportsObj, nested = 0) => {
    const classRegExp = /^(?:\t|\s)*class\s+(\w+)(?:\s+extends\s+\w+)*\s*\{/;
    const funcRegExp = /^(?:\t|\s)*(?:async\s)*function\s*(\w+)\s*(?:\{|\()/;
    const globalVarRegExp = /^(?:var|const|let)(?=\s+([\w-]+)(?:(?:\s+\=\s+)|$))/;

    const [full, name] =
        line.match(classRegExp) ||
        line.match(funcRegExp) ||
        line.match(globalVarRegExp) ||
        [];

    nested || name && exportsObj.push(name);

    const changed = grep.reduce((acc, config) => acc.replace(config.match, config.replace), line);
    await write(`${changed}\n`);
};

/**
 * Performs modifications on file lines
 * @param {String} path 
 * @param {String} [destination='']
 * @param {WritableStream} stream 
 * @param {RequireGREP[]} [grep=[]]
 * @param {RequireModules} [required={}]
 * @param {String} [use=root]
 * @param {Controller} JC
 * @returns {WritableStream}
 */
const expose = async (path, destination, stream, grep = [], required = {}, use = 'root', JC) => {
    const write = util.promisify(stream.write).bind(stream);

    const includedModules = Object.entries(required)
        .map(entry => {
            const [key, source] = entry;

            const prefixed = source.split('::');

            const hasPrefix = prefixed.length > 1;

            const pathToModule = hasPrefix ? prefixed[1] : source;

            const resolved = hasPrefix ?
                relPath('', pathToModule)(prefixed[0]) :
                relPath(destination, pathToModule)(use);

            const isCore = /^\w+$/.test(pathToModule);

            isCore || validateFilePath(resolved, use, JC);

            return `${key !== '' ? `const ${key} = ` : ''}require("${
                /[^\w-]/.test(source) ? resolved : source
                }");`;
        });

    includedModules.length && await write(`${includedModules.join('\n')}\n\n`);

    const IF = readlineFromPath(path);

    const exportsObj = [];

    let nested = 0;

    for await (const line of IF) {
        await processLine(write, line, grep, exportsObj, nested);
        nested += isBalanced(line);
    }

    const moduleExports = `{\n${exportsObj
        .map(l => '\t' + l)
        .join(',\n')}\n};`;

    await write('\nmodule.exports = exports = ' + moduleExports);

    return stream;
};

/**
 * 1. Exposes file's globally defined classes and functions to module.exports
 * 2. Exports file as Common.js module in the folder specified or root dir
 * 3. Clears module cache if required module was loaded before
 * 3. Requires the file for use
 * @param {String} filePath path to source file
 * @param {String} folderPath path to destination folder
 * @param {ExposeRequireOptions} options configuration object
 * @returns {*} required module content
 */
const exposeAndRequire = async (filePath, folderPath = '.', options = {}) => {

    const JC = new Controller({}, options);

    JC.time('All');

    const { skip, use } = options;

    const validInPath = validateFilePath(filePath, use, JC);

    const inputFilePath = pt.parse(validInPath);

    const validOutPath = validatePath(folderPath);

    const outFilePath = pt.resolve(validOutPath, inputFilePath.base);

    try {
        const start = await getLineBytes(outFilePath, skip) || 0;

        const writeable = fs.createWriteStream(outFilePath, {
            start,
            flags: start ? 'r+' : 'w'
        });

        const { grep, require: required } = options;

        await expose(filePath, folderPath, writeable, grep, required, use, JC);

        JC.success(`[EXPOSED] ${filePath} => ${folderPath}`);

        clearCached(outFilePath);

        JC.timeEnd();

        return require(`${outFilePath}`);
    }
    catch (handlingError) {
        JC.err(`[FAILED] Couldn't require module "${filePath}":\n${handlingError}`);
    }
};

module.exports = {
    exposeAndRequire
};
