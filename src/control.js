/**
 * @module Controller
 * @author Oleg Valter
 * @version 1.3.3
 */

const { EventEmitter } = require('events');
const { blue, green, red, yellow } = require('chalk');

const { validateLog } = require('./validator.js');

/**
 * @typedef {import('./main.js').ExposeRequireOptions} ExposeRequireOptions
 */


/**
 * Strips colour escape sequences
 * @param {string} msg
 * @returns {string} 
 */
const stripColor = (msg) => msg.replace(/\u001b\[(?:0|1)*;*(?:3|4)(?:\d)m/g, '');

/**
 * Expose and Require Controller
 * @class
 */
class Controller extends EventEmitter {

    #color = true;
    #elapsed = 0;
    #mute = false;
    #timer = null;
    #timerLabel = null;

    /**
     * @param {EventEmitterOptions} emitterOpts
     * @param {ExposeRequireOptions} [opts]
     */
    constructor(emitterOpts = {}, opts = {}) {

        super(emitterOpts);

        opts.mute && this.mute();

        this.#color = opts.color || true;

        this.output = validateLog(opts.log);

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

        this.emit('log', message, level);

        logs
            .set(Date.now(), {
                message,
                level
            });

        this.#color || (message = stripColor(message));

        this.#mute || output.write(`${message}\n`);

        return this;
    }

    /**
     * Mutes log output
     * @returns {Controller}
     */
    mute() {
        this.emit('mute');

        this.#mute = true;
        return this;
    }

    /**
     * Starts timer
     * @param {string} [label]
     * @returns {Controller}
     */
    time(label) {
        this.timeReset();

        const alreadyRunning = this.#timer;

        alreadyRunning && clearInterval(this.#timerLabel);

        const timer = setInterval(() => this.#elapsed += .001, 1);

        this.#timer = timer;

        typeof label === 'string' &&
            (this.#timerLabel = label);

        return this;
    }

    /**
     * Resets timer
     * @returns {Controller}
     */
    timeReset() {
        this.#elapsed = 0;
        return this;
    }

    /**
     * Ends timer
     * @returns {number}
     */
    timeEnd() {
        const elapsed = this.#elapsed.toFixed(3);

        const timer = this.#timer;

        if (timer) {
            const label = this.#timerLabel;

            clearInterval(timer);

            this.log(`${label || 'Timer'} done in ${elapsed}s`);
        }

        this.timeReset();

        return elapsed;
    }

    /**
     * Unmutes log output
     * @returns {Controller}
     */
    unmute() {
        this.emit('unmute');

        this.#mute = false;
        return this;
    }

}

module.exports = exports = Controller;