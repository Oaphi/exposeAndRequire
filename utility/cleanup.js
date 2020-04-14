const fs = require('fs');
const pt = require('path');

const { PATHS } = process.env;

/**
 * @summary Cleans root path and subpaths
 * @param {string} rootPath 
 */
const cleanOfEntries = (rootPath) => {
    if (fs.existsSync(rootPath)) {

        const entries = fs.readdirSync(rootPath, { withFileTypes: true });

        for (const entry of entries) {
            const thisPath = pt.resolve(rootPath, entry.name);

            if (fs.existsSync(thisPath)) {
                entry.isDirectory() && cleanOfEntries(thisPath);
                entry.isFile() && fs.unlinkSync(thisPath);
            }
        }

        fs.rmdirSync(rootPath);
    }
};

const log = fs.createWriteStream(pt.resolve(__dirname, 'log.txt'));

process
    .on('uncaughtException', (error) => {
        log.write('\n' + error.message + '\n');
    })
    .on('error', (error) => {
        log.write('\n' + error.message + '\n');
    })
    .on('exit', () => {
        log.write('\nexited\n');
    });

for (const path of PATHS.split(',')) {
    log.write(path + '\n');
    cleanOfEntries(path);
}