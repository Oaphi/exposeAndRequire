/**
 * Deep freezes an object
 * @param {object} obj 
 * @returns {object}
 */
const frost = (obj = {}) => {
    Object.freeze(obj);

    for (const key in obj) {
        const val = obj[key];
        if (val && typeof val === 'object') {
            frost(val);
        }
    }

    return obj;
};

/**
 * @enum
 */
const ERRS = frost({
    Intercept: {
        original: 'Nothing to wrap',
        callback: 'Nothing to handle'
    },
    Retry: {
        callback: 'Nothing to retry',
        negative: "Can't retry negative times"
    }
});

/**
 * Checks if line balances "{}".
 * Returns >0 if the string is string is left-unbalanced
 * Returns 0 if the string is balanced
 * Returns <0 if the string is string is right unbalanced
 * @param {string} line
 * @returns {number}
 */
const isBalanced = (line) => {
    let balance = 1;

    for(const char of line) {
        char === '{' && (balance = balance << 1);
        char === '}' && (balance = balance >> 1);
    }

    return balance - 1;
};

/**
 * Intercepts synchrnous errors
 * @param {function} original
 * @param {function} errorCallback
 * @return {function}
 */
const interceptErrors = (original, errorCallback) => {

    if (!original) {
        throw new SyntaxError(ERRS.Intercept.original);
    }

    if (!errorCallback) {
        throw new SyntaxError(ERRS.Intercept.callback);
    }

    return (...args) => {
        try {
            return original(...args);
        }
        catch (error) {
            return errorCallback(error, ...args);
        }
    };
};

/**
 * Retries callback if it errs
 * @param {function} callback 
 * @param {number} [times] 
 * @returns {function}
 */
const retry = (callback, times = 0) => {
    const { Retry } = ERRS;

    if (!typeof callback === 'function') {
        throw new SyntaxError(Retry.callback);
    }

    if (times < 0) {
        throw new RangeError(Retry.negative);
    }

    const wrapped = interceptErrors(callback, (error, ...args) => {
        if (times === 0) {
            throw error;
        }

        times--;

        return wrapped(...args);
    });

    return wrapped;
};

/**
 * Clears module cache
 * @param {string} rule 
 * @returns {void}
 */
const clearCached = (rule) => {

    if (typeof rule !== 'string') {
        throw new TypeError(`Expected a string, received ${typeof rule}`);
    }

    try {
        const { cache } = require;
        const cacheEntries = Object.entries(cache);

        const entriesToDelete = cacheEntries.filter(entry => {
            const [modulePath] = entry;
            return new RegExp(rule).test(modulePath);
        });

        for(const entry of entriesToDelete) {
            delete cache[entry[0]];
        }
    }
    catch (regexpErr) {
        throw new SyntaxError(`Invalid removal term: ${regexpErr}`);
    }
};

/**
 * Map of directory options to resolve against 
 * @enum {Map<string, string>}
 * @property {string} cwd resolve against process cwd
 * @property {string} module resolve against module dir
 * @property {string} root resolve against package root
 */
const dirMap = new Map()
    .set('cwd', process.cwd())
    .set('module', __dirname)
    .set('root', '.');

module.exports = {
    interceptErrors,
    isBalanced,
    clearCached,
    dirMap,
    retry
};