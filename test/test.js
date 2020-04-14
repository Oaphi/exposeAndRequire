const { exposeAndRequire } = require('../src/main');
const fs = require('fs');
const pt = require('path');
const _ = require('lodash');
const { spawn } = require('child_process');

const chai = require('chai');
const chaiprom = require('chai-as-promised');
chai.use(chaiprom);

const { expect } = chai;

const removeRequired = (rule = 'tested') => {
    const { cache } = require;
    const cacheEntries = Object.entries(cache);

    for (const entry of cacheEntries) {
        const [modulePath] = entry;

        if (new RegExp(rule).test(modulePath)) {
            delete cache[modulePath];
        }
    }
};

const sourcePath = 'test/source/tested.js';

const TEST_PATHS = {
    BASE: 'test/mocks',
    COLONS: 'test/mocks/colon test',
    CORE: 'test/mocks/with core modules',
    EXTRAS: 'test/mocks/withExtras',
    LOGS: 'test/mocks/logs',
    MUTE: 'test/mocks',
    NOFOLDER: 'test/mocks/no folder',
    NOTFOUND: 'test/nonexistent',
    NOTFOUND_RECURSE: 'test/nonexistent/recursive',
    REQUIRED: 'test/mocks/with required',
    ROOT: '.',
    SCOPED: 'test/mocks/with scoped',
    ROOTED: 'root::',
    SPACES: 'test/mocks with spaces'
};

describe('exposeAndRequire', function () {
    let mocked;

    this.slow(300);

    before(async () => mocked = await exposeAndRequire(sourcePath, TEST_PATHS.BASE));

    afterEach(() => removeRequired('tested'));

    it('should have all base classes exported', async function () {
        const { BaseClass, BaseClassLine, BaseClassSpaced, BaseClassTabbed } = mocked;

        expect(BaseClass).to.not.be.undefined;
        expect(BaseClassLine).to.not.be.undefined;
        expect(BaseClassSpaced).to.not.be.undefined;
        expect(BaseClassTabbed).to.not.be.undefined;
    });

    it('should expose all global variables', function () {
        const { constVar, letVar, varVar } = mocked;

        expect(constVar).to.not.be.undefined;
        expect(letVar).to.not.be.undefined;
        expect(varVar).to.not.be.undefined;
    });

    it('should expose all global variables tabbed from start', function () {
        const { constSpaced, letSpaced, varSpaced } = mocked;

        expect(constSpaced).to.not.be.undefined;
        expect(letSpaced).to.not.be.undefined;
        expect(varSpaced).to.not.be.undefined;
    });

    it('should expose all functions', function () {
        const { asynchronous, asyncTabbed, synchronous } = mocked;

        expect(asynchronous).to.not.be.undefined;
        expect(synchronous).to.not.be.undefined;
        expect(asyncTabbed).to.not.be.undefined;
    });

    it('should require all modules specified', async function () {
        const outputFolder = TEST_PATHS.REQUIRED;

        await exposeAndRequire(sourcePath, outputFolder, {
            require: {
                "required": TEST_PATHS.ROOTED + "src/utils.js"
            }
        });

        const content = fs.readFileSync(pt.join(outputFolder, 'tested.js'), { encoding: 'utf8' });

        expect(/const required = require\([^)]+utils\.js\"\)/.test(content)).to.be.true;
    });

    it('should not freeze on ":" typo instead of "::"', async function () {

        this.timeout(1000);

        const module = exposeAndRequire(sourcePath, TEST_PATHS.COLONS, {
            require: {
                '{ myself }': "root:test/mocks/tested.js"
            }
        });

        await expect(module).to.eventually.be.fulfilled;
    });

    it('edge: should consider xmlhttprequest-ssl core module', async function () {

        const mod = await exposeAndRequire(sourcePath, TEST_PATHS.COLONS, {
            require: {
                '{ myself }': "xmlhttprequest-ssl"
            }
        });

        const nonCore = fs.existsSync(TEST_PATHS.COLONS + '/xmlhttprequest-ssl');
        expect(nonCore).to.be.false;
    });

    it('should ignore block scoped vars', async function () {
        const mockedWithScope = await exposeAndRequire(sourcePath, TEST_PATHS.SCOPED);

        const nest = mockedWithScope.functionWithNestedFuncions;

        expect(nest).to.not.be.undefined;
        expect(mockedWithScope.nested).to.be.undefined;
    });

    describe('Input file', function () {

        it('should create file if not found', async function () {
            const noFile = TEST_PATHS.BASE + '/no-such-file.js';
            await exposeAndRequire(noFile, TEST_PATHS.NOTFOUND);
            expect(fs.existsSync(noFile)).to.be.true;
        });

        it('should create folder if not found', async function () {
            const noFolder = TEST_PATHS.NOFOLDER + '/noFile.js';
            await exposeAndRequire(noFolder, TEST_PATHS.NOTFOUND);
            expect(fs.existsSync(noFolder)).to.be.true;
        });

        it('should process files from folders with spaces', async function () {
            const spaces = TEST_PATHS.SPACES + '/fileFromFolderWithSpaces.txt';
            expect(exposeAndRequire(spaces, TEST_PATHS.BASE)).to.eventually.be.fulfilled;
            expect(fs.existsSync(spaces)).to.be.true;
        });

    });

    describe('Output folder', function () {

        it('should export to root if only source path', async function () {
            await exposeAndRequire(sourcePath);
            expect(fs.existsSync(TEST_PATHS.ROOT + '/tested.js')).to.be.true;
        });

        it('should export to root on empty string', async function () {
            await exposeAndRequire(sourcePath, TEST_PATHS.ROOT);
            expect(fs.existsSync(TEST_PATHS.ROOT + '/tested.js')).to.be.true;
        });

        it('should export to correct folder', async function () {
            await exposeAndRequire(sourcePath, TEST_PATHS.BASE);
            expect(fs.existsSync(TEST_PATHS.BASE + '/tested.js')).to.be.true;
        });

        it('should create non-existent folders recursively', async function () {
            await exposeAndRequire(sourcePath, TEST_PATHS.NOTFOUND_RECURSE);
            expect(fs.existsSync(TEST_PATHS.NOTFOUND_RECURSE)).to.be.true;
        });

        it('should output to folders with spaces', async function () {
            const outputFolder = TEST_PATHS.SPACES;
            await exposeAndRequire(sourcePath, outputFolder);
            expect(fs.existsSync(outputFolder)).to.be.true;
        });

    });

    describe('Required modules', function () {

        it('should not validate core modules', async function () {
            const outputFolder = TEST_PATHS.CORE;

            await exposeAndRequire(sourcePath, outputFolder, {
                require: {
                    "fs": "fs"
                }
            });

            const fsCreated = fs.existsSync(pt.join(outputFolder, 'fs'));
            expect(fsCreated).to.be.false;
        });

    });

    describe('Extra options', function () {

        it('should mute logs if `mute` option provided', async function () {
            const logFolder = TEST_PATHS.LOGS;
            const logFile = pt.join(logFolder, 'log.txt');

            const existsLog = fs.existsSync(logFile);

            existsLog && fs.truncateSync(logFile);

            await exposeAndRequire(TEST_PATHS.BASE + '/mutemock.txt', TEST_PATHS.BASE, {
                mute: true,
                log: logFolder,
                color: false
            });

            expect(fs.existsSync(logFile)).to.be.true;

            const stats = fs.statSync(logFile);

            expect(stats.size).to.equal(0);
        });

        it('should expose only if exposeOnly set', async function () {
            const module = await exposeAndRequire(sourcePath, TEST_PATHS.BASE, {
                exposeOnly: true
            });
            expect(module).to.be.null;
        });

    });

    it.skip('should expose additional modules if specified', async function () {
        mocked = await exposeAndRequire(sourcePath, TEST_PATHS.EXTRAS, {
            expose: {
                "mocks/forExposure.js": {
                    name: 'exposedUtils',
                    output: TEST_PATHS.EXTRAS
                }
            },
            use: "cwd"
        });


    });

});

/**
 * @summary Spawns completely detached child
 * @param {NodeJS.Process} parent 
 * @param {string} path 
 * @param {object} env 
 * @return {NodeJS.Process}
 */
const spawnResponsible = (parent, path, env) => {
    const child = spawn(parent.argv0, [path], {
        env,
        detached: true,
        stdio: "ignore"
    });

    child.unref();

    return child;
};

const posArgs = process.argv.slice(2);
const keepTestOutput = posArgs.includes('--keep');

//clean up after testing
keepTestOutput || (
    process.once('beforeExit', () => {

        const CWD = process.cwd();

        const protected = ['.', 'root::'];

        const paths = Object.values(TEST_PATHS);

        const testedInRoot = pt.resolve(TEST_PATHS.ROOT, 'tested.js');

        fs.existsSync(testedInRoot) && fs.unlinkSync(testedInRoot);

        const pathsToClean = paths
            .filter(path => !protected.includes(path))
            .map(path => pt.resolve(CWD, path));

        spawnResponsible(
            process,
            pt.resolve(TEST_PATHS.ROOT, 'utility/cleanup.js'),
            {
                PATHS: pathsToClean
            }
        );

    })
);