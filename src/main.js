const fs = require('fs');
const rl = require('readline');
const util = require('util');
const pt = require('path');

const asyncAccess = util.promisify(fs.access);
const asyncAppendFile = util.promisify(fs.appendFile);
const asyncChmod = util.promisify(fs.chmod);

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
dirMap.set('root', '.');

/**
 * Logs a message to stdout (shortcut)
 * @param {String} msg 
 */
const log = (msg) => process.stdout.write(msg);

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
const relPath = (from, to) => (use) => {
    const choice = dirMap.get(use);

    const path = pt
        .resolve(choice, from, to)
        .replace(/\\/g, '/');

    return path;
};

/**
 * 
 * @param {String} path 
 * @param {String} [destination='']
 * @param {WritableStream} stream 
 * @param {RequireGREP[]} [grep=[]]
 * @param {RequireModules} [require={}]
 * @param {String} [use=root]
 * @returns {WritableStream}
 */
const expose = async (path, destination, stream, grep = [], require = {}, use = 'root') => {
    const write = util.promisify(stream.write).bind(stream);

    const includedModules = Object.keys(require)
        .map(key => {
            const source = require[key];

            const prefixed = source.split('::');

            const hasPrefix = prefixed.length > 1;

            const resolved = hasPrefix ?
                relPath('', prefixed[1])(prefixed[0]) :
                relPath(destination, source)(use);

            return `${key !== '' ? `const ${key} = ` : ''}require("${
                /[^\w-]/.test(source) ? resolved : source
                }");`;
        });

    includedModules.length && await write(`${includedModules.join('\n')}\n\n`);

    const IF = readlineFromPath(path);

    const exportsObj = [];

    const processLine = async (line) => {
        const classRegExp = /^(?:\t|\s)*class\s+(\w+)(?:\s+extends\s+\w+)*\s*\{/;
        const funcRegExp = /^(?:async\s)*function\s+(\w+)\s*(?:\{|\()/;
        const globalVarRegExp = /^(?:var|const|let)(?=\s+([\w-]+)(?:(?:\s+\=\s+)|$))/;

        const [full, name] =
            line.match(classRegExp) ||
            line.match(funcRegExp) ||
            line.match(globalVarRegExp) ||
            [line];

        name && exportsObj.push(name);

        //replace strings matchign greps;
        const changed = grep.reduce((acc, config) => acc.replace(config.match, config.replace), line);
        await write(`${changed}\n`);
    };

    for await (const line of IF) {
        processLine(line);
    }

    const moduleExports = `{\n${exportsObj
        .map(l => '\t' + l)
        .join(',\n')}\n};`;

    await write('\nmodule.exports = ' + moduleExports);

    return stream;
};

/**
 * 1. Exposes file's globally defined classes and functions to module.exports
 * 2. Exports file as Common.js module in the folder specified or root dir
 * 3. Requires the file for use
 * @param {String} filePath path to source file
 * @param {String} folderPath path to destination folder
 * @param {Object} options configuration object
 * @param {RequireGREP[]} options.grep update lines matching regex
 * @param {RequireModules} options.require include specified modules
 * @param {Number} options.skip lines to skip when writing
 * @param {String} options.use which folder to relate to
 * @returns {*} required module content
 */
const exposeAndRequire = async (filePath, folderPath = '.', options = {}) => {

    const inputPath = pt.parse(filePath);

    const outputPath = pt.resolve(folderPath, inputPath.base);

    const existingFolderOath = asyncAccess(folderPath)
        .then(() => log(`[OK] output folder exists or is root\n`))
        .catch(err => {
            err.code === 'ENOENT' && fs.mkdirSync(folderPath, { recursive: true });
            log(`[OK] created folder ${folderPath}\n`);
        });

    const readWriteMask = fs.constants.W_OK | fs.constants.R_OK;

    const existingOutputFileOath = asyncAccess(outputPath, readWriteMask)
        .then(() => log(`[OK] output file exists and can be written\n`))
        .catch(async err => {

            const makeIfNone = err.code === 'ENOENT' && asyncAppendFile(outputPath, '')
                .then(() => log(`[OK] created output file\n`))
                .catch(err => {
                    //TODO handle file creation issues
                });

            const permitIfNot = err.code === 'EPERM' && asyncChmod(outputPath, '0o755')
                .then(() => log(`[OK] changed file permissions to read, write\n`))
                .catch(err => {
                    log(`[STOP] not enough permissions to change mode\n`);
                    process.exit(1);
                });

            return Promise.all([makeIfNone, permitIfNot]);
        });

    await Promise.all([existingFolderOath, existingOutputFileOath]);

    const skipBytes = await (getLineBytes(outputPath, options.skip));

    const writeable = fs.createWriteStream(outputPath, {
        start: skipBytes || 0,
        flags: skipBytes ? 'r+' : 'w'
    });

    await expose(filePath, folderPath, writeable, options.grep, options.require, options.use);

    return require(`${outputPath}`);
};

module.exports = {
    exposeAndRequire
};
