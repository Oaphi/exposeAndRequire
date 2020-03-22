/**
 * Deep freezes an object
 * @param {Object} obj 
 * @returns {Object}
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

const ERRS = frost({
    Intercept: {
        original: 'Nothing to wrap',
        callback: 'Nothing to handle'
    }
});

/**
 * Intercepts synchrnous errors
 * @param {Function} original 
 * @param {Function} errorCallback 
 * @return {Function}
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
            return errorCallback(error);
        }
    };
};

module.exports = {
    interceptErrors
};