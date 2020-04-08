#!/usr/bin/env node
const { Transform, pipeline } = require('stream');

const { createReadStream, readdirSync, createWriteStream } = require('fs');

const pt = require('path');

const { createInterface } = require('readline');

const { version, repository } = require('../package.json');

const yargs = require('yargs');

const { argv } = yargs
    .command('$0', 'Updates package version', (_) => {
        return _
            .epilog(`For more info, see ${repository.url}`)
            .option('description', {
                alias: 'D',
                describe: 'Package update description',
                group: 'Package:',
                requiresArg: true,
                type: 'array'
            })
            .option('semver', {
                alias: 'V',
                choices: ['major', 'minor', 'patch'],
                default: 'patch',
                describe: 'Semantic version',
                group: 'Package:',
                type: 'string'
            })
            .option('templates', {
                alias: 'T',
                default: './templates',
                describe: 'Templates to scan for versions',
                group: 'Templates',
                normalize: true,
                requiresArg: true,
                type: 'string'
            })
            .option('decrement', {
                alias: 'd',
                conflicts: ['i', 'increment'],
                describe: 'Decrements semantic version',
                group: 'Package:',
                type: 'boolean'

            })
            .option('increment', {
                alias: 'i',
                conflicts: ['d', 'decrement'],
                describe: 'Increments semantic version',
                group: 'Package:'
            });
    }, (args) => {
        const { semver } = args;

        const indices = new Map()
            .set('major', 0)
            .set('minor', 1)
            .set('patch', 2);

        args.semver = indices.get(semver);

        return args;
    })
    .help()
    .alias('help', 'h')
    .group('help', 'Usage:')
    .version('version', 'Displays module version', version)
    .alias('version', 'v')
    .group('version', 'Other:')
    .strict(true)
    .middleware([
        (args) => {
            const { description = [] } = args;

            if (description.length) {
                args.description = new Set(description);
                return args;
            }

            return new Promise((resolve, reject) => {
                const temp = new Set();

                const loopWhatChanged = talk => answer => {
                    temp.add(answer);
                    talk
                        .question('Anything else?\n', ans => {
                            ans && !(/^(?:no|n)$/i.test(ans)) ?
                                loopWhatChanged(talk)(ans) :
                                (() => {
                                    args.description = temp;
                                    talk.close();
                                    resolve(args);
                                })();
                        });
                };

                const talk = createInterface({
                    input: process.stdin,
                    output: process.stdout
                });
                talk
                    .on('error', reject)
                    .question('What has changed?\n', loopWhatChanged(talk));
            });
        }
    ]);

class Parser extends Transform {

    static #match = /\${(\w+)}/g;
    static #map = new Map();

    constructor(options) {
        super(options);
    }

    /**
     * @param {Buffer|string} chunk 
     * @param {string} encoding 
     * @param {function} callback 
     * @private
     */
    _transform(chunk, encoding, callback) {

        const processed = chunk
            .toString('utf8')
            .replace(Parser.#match, (full, name) => {
                const value = Parser.#map.get(name);

                const isFunc = typeof value === 'function';

                return isFunc ? value() : value;
            });

        this.push(processed);

        callback();
    }

    static templates(map = {}) {
        for (const key in map) {
            this.#map.set(key, map[key]);
        }
        return this;
    }

}

const increment = (num = 0) => num = +num + 1;

const decrement = (num = 0) => num = +num - 1;

const init = async () => {
    const { d, i, description, semver, templates } = await argv;

    const CWD = process.cwd();

    const versionNumbers = version.split('.');

    const updated = versionNumbers
        .map((num, pos) => pos === semver ?
            (
                i ? increment(num) : d ? decrement(num) : num
            ) :
            num)
        .join('.');

    Parser
        .templates({
            version: updated,
            description: ((descr) => () => {
                const cell = [...descr.values()].join('<br>');
                return `<tr><td>${updated}</td><td>${cell}</td><td>-</td></tr>`;
            })(description)
        });

    const inputPath = pt.resolve(CWD, templates);

    const dir = readdirSync(inputPath, { withFileTypes: true });

    for (const file of dir) {
        const { name } = file;

        const filePath = pt.resolve(CWD, templates, name);

        const outPath = pt.resolve(CWD, name);

        pipeline(
            createReadStream(filePath),
            new Parser(),
            createWriteStream(outPath),
            (err) => {
                err && console.log(err);
            }
        );
    }

    return;
};

init();