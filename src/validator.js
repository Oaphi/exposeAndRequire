/**
 * @module Validator
 * @author Oleg Valter
 * @version 1.3.3
 */

const fs = require('fs');
const pt = require('path');
const { execSync } = require('child_process');

const { dirMap, interceptErrors } = require('./utils.js');

/**
 * Prepares output path for export
 * @param {string} path
 * @param {string} [use=root]
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
 * @returns {string}
 */
const validateFilePath = (path, use = 'root') => {
    const parsed = pt.parse(path);

    const { base, dir } = parsed;

    const validPath = validatePath(dir, use);

    const validFilePath = pt.resolve(validPath, base);

    if (!fs.existsSync(validFilePath)) {
        try {
            execSync(`touch "${path}"`);
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
 * @returns {NodeJS.WritableStream|string}
 */
const validateLog = (output) => {

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

module.exports = {
    validateLog,
    validatePath,
    validateFilePath
}