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

module.exports = {
    interceptErrors,
    retry
};