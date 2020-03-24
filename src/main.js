const fs = require('fs');
const rl = require('readline');
const util = require('util');
const pt = require('path');
const { EventEmitter } = require('events');
const { blue, green, red, yellow } = require('chalk');
const { execSync } = require('child_process');

const { clearCached, interceptErrors } = require('./utils.js');

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
 * Map of directory options to 
 * resolve against when requiring
 * and making outputs
 * @enum {Map<string, string>}
 * @property {string} cwd resolve against process cwd
 * @property {string} module resolve against module dir
 * @property {string} root
 */
const dirMap = new Map();
dirMap.set('cwd', process.cwd());
dirMap.set('module', __dirname);
dirMap.set('root', '.');


/**
 * Prepares output path for export
 * @param {string} path
 * @param {string} [use=root]
 * @param {Controller} JC
 * @return {string}
 */
const validatePath = interceptErrors(
    (path, use = 'root') => {
        const checkedPath = !path || path === '' ? dirMap.get(use) : path;

        if (!fs.existsSync(checkedPath)) {
            fs.mkdirSync(checkedPath, { recursive: true });
        }

        return checkedPath;
    },
    () => console.warn('') //TODO add handling
);

/**
 * Prepares input path for import
 * @param {string} path 
 * @param {string} [use=root] 
 * @param {Controller} JC
 * @returns {string}
 */
const validateFilePath = (path, use = 'root', JC) => {
    const parsed = pt.parse(path);

    const { base, dir } = parsed;

    const validPath = validatePath(dir, use, JC);

    const validFilePath = pt.resolve(validPath, base);

    if (!fs.existsSync(validFilePath)) {
        try {
            execSync(`touch "${path}"`);
            JC.success(`[RESOLVED] Created source: ${path}`);
        }
        catch (touchError) {
            //TODO: handle
        }
    }

    return validFilePath;
};

/**
 * Validate output redirection
 * @param {NodeJS.WritableStream|string} output 
 * @param {Controller} JC
 * @returns {NodeJS.WritableStream|string}
 */
const validateLog = (output, JC) => {

    if (!output) {
        return process.stdout;
    }

    if (typeof output === 'string') {
        try {
            const parsed = pt.parse(output);

            const { base, dir, ext } = parsed;

            const dirPath = ext !== '' ? dir : output;

            const validPath = validatePath(dirPath);

            const logFilePath = pt.join(validPath, ext !== '' ? base : 'log.txt');

            return fs.createWriteStream(logFilePath, { flags: "a+" });
        }
        catch (notAPath) {
            throw new TypeError('Output should be a valid path');
        }
    }

    const { write, writeable } = output;

    if (typeof write !== 'function' || !writeable) {
        throw new TypeError('Output redirect should be writable');
    }

    return output;
};

const stripColor = (msg) => msg.replace(/\u001b\[(?:0|1)*;*(?:3|4)(?:\d)m/g, '');

class Controller extends EventEmitter {

    #color = true;
    #mute = false;

    /**
     * @param {EventEmitterOptions} emitterOpts
     * @param {ExposeRequireOptions} [opts]
     */
    constructor(emitterOpts = {}, opts = {}) {

        super(emitterOpts);

        this.#mute = opts.mute || false;
        this.#color = opts.color || false;

        this.output = validateLog(opts.log, this);

        this.logs = new Map();
    }

    /**
     * Logs a message at debug level
     * @param {string} msg 
     * @returns {Controller}
     */
    debug(msg) {
        return this.log(blue(msg), 'debug');
    }

    /**
     * Logs an error level message
     * @param {string} msg 
     * @returns {Controller}
     */
    err(msg) {
        return this.log(red(msg), 'error');
    }

    /**
     * Logs a message at success level
     * @param {string} msg 
     * @returns {Controller}
     */
    success(msg) {
        return this.log(green(msg), 'success');
    }

    /**
     * Logs a warning level message
     * @param {string} msg 
     * @returns {Controller}
     */
    warn(msg) {
        return this.log(yellow(msg), 'warn');
    }

    /**
     * Logs a message
     * @param {string} message 
     * @param {string} level 
     * @returns {Controller}
     */
    log(message, level = 'log') {
        const { logs, output } = this;

        this.emit(level);

        logs
            .set(Date.now(), {
                message,
                level
            });

        this.#color || (message = stripColor(message));

        this.#mute || output.write(`${message}\n`);

        return this;
    }

    mute() {
        this.emit('mute');

        this.#mute = true;
        return this;
    }

    unmute() {
        this.emit('unmute');

        this.#mute = false;
        return this;
    }

}

/**
 * Creates readline interface from path 
 * for reading files line by line
 * @param {String} path valid path 
 * @returns {Interface}
 */
const readlineFromPath = (path) => {
    const read = fs.createReadStream(path, { flags: 'a+' });
    return rl.createInterface(read);
};

/**
 * Counts number bytes in first N lines of a file
 * @param {String} path valid path
 * @param {Number} [lines] lines to count
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
 */
const processLine = async (write, line, grep, exportsObj) => {
    const classRegExp = /^(?:\t|\s)*class\s+(\w+)(?:\s+extends\s+\w+)*\s*\{/;
    const funcRegExp = /^(?:\t|\s)*(?:async\s)*function\s+(\w+)\s*(?:\{|\()/;
    const globalVarRegExp = /^(?:var|const|let)(?=\s+([\w-]+)(?:(?:\s+\=\s+)|$))/;

    const [full, name] =
        line.match(classRegExp) ||
        line.match(funcRegExp) ||
        line.match(globalVarRegExp) ||
        [line];

    name && exportsObj.push(name);

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

            const resolved = hasPrefix ?
                relPath('', prefixed[1])(prefixed[0]) :
                relPath(destination, source)(use);

            validateFilePath(resolved, JC);

            return `${key !== '' ? `const ${key} = ` : ''}require("${
                /[^\w-]/.test(source) ? resolved : source
                }");`;
        });

    includedModules.length && await write(`${includedModules.join('\n')}\n\n`);

    const IF = readlineFromPath(path);

    const exportsObj = [];

    for await (const line of IF) {
        await processLine(write, line, grep, exportsObj);
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

    const { skip, use } = options;

    const validInPath = validateFilePath(filePath);

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

        return require(`${outFilePath}`);
    }
    catch (handlingError) {
        JC.err(`[FAILED] Could not process file:\n${handlingError}`);
    }
};

module.exports = {
    Controller,
    exposeAndRequire
};
