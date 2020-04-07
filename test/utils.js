const pt = require('path');

const assert = require('assert');
const { expect } = require('chai');

const utilities = require('../src/utils.js');
const main = require('../src/main.js');

describe('Utilities', function () {
    const { exposeAndRequire } = main;

    const { clearCached, interceptErrors, isBalanced, retry } = utilities;

    describe('clearCached', function () {

        it('should throw SyntaxError on invalid rule', function () {
            expect(() => clearCached(false)).to.throw(TypeError);
            expect(() => clearCached({})).to.throw(TypeError);
        });

        it('should remove module from cache', async function () {
            const source = 'test/mocks/folder.txt';
            const output = 'test/mocks/cache test';

            await exposeAndRequire(source, output);

            const idToClear = pt.resolve(output, 'folder.txt');

            clearCached('folder.txt');

            const found = Object
                .entries(require.cache)
                .filter(entry => entry[0] === idToClear);

            expect(found.length).to.equal(0);
        });

    });

    describe('interceptErrors()', function () {

        it('should throw on no args', function () {
            assert.throws(() => interceptErrors());
        });

        it('should throw on no handler', function () {
            assert.throws(() => interceptErrors(() => { }));
        });

        it('should catch wrapped erros', function () {
            const original = () => {
                throw new Error('Caught');
            };

            const handler = error => console.log(error);
            const wrapped = () => interceptErrors(original, handler);

            assert.doesNotThrow(wrapped);
        });

        it('should pass error object to handler', function () {
            const error = new Error('Caught');

            const original = () => {
                throw error;
            };

            const handler = error => error;
            const wrapped = interceptErrors(original, handler);

            const caughtError = wrapped();

            assert.strictEqual(Object.is(error, caughtError), true);
        });

    });

    describe('isBalanced()', function () {

        it('should be 0 for balanced', function () {
            const strs = [
                '{{ such balance! }}', 
                'const { balance } = this', 
                'const a = { b: { c: {}} }',
                '{}{}{}{}{}{}{}{}{}{}{}{}{}{}',
                '{{{{{{{{{{{{{{{{{{{}}}}}}}}}}}}}}}}}}}'
            ];
            const balanced = strs.reduce((total,str) => total + isBalanced(str), 0);
            expect(balanced).to.be.equal(0);
        });

        it('should be > 0 for left-unbalanced', function () {
            const leftUnbalanced = [
                '{{{{ evenly left }}',
                ' {{{ //drops }} {{{{ left',
                '{{{{{{{{{{{{{{{{{{{{{{{ leeeeft',
                '{'
            ];
            const test = leftUnbalanced.reduce((total,str) => total + isBalanced(str), 0);
            expect(test).to.be.greaterThan(0);
        });

        it('should be < 0 for right-unbalanced', function () {
            const rightUnbalanced = [
                '{{ drops  }}}} right',
                'riiiight }}}}}}}}}}}}}}}}}}}}}}}',
                '}'
            ];
            const test = rightUnbalanced.reduce((total, str) => total + isBalanced(str), 0);
            expect(test).to.be.lessThan(0);
        });

        it('edge case: should be 0 for } else {', function () {
            const butterflies = [
                '} else {',
            ];
            const test = butterflies.reduce((total, str) => total + isBalanced(str), 0);
            expect(test).to.be.equal(0);
        });

        it('edge case: should be < 0 for } else if () {  }', function () {
            const leftClosing = [
                '} else if (A < B) { return 1; }'
            ];
            const test = leftClosing.reduce((total, str) => total + isBalanced(str), 0);
            expect(test).to.be.lessThan(0);
        });

    });

    describe('retry()', function () {

        it('should throw on no callback', function () {
            const fails = () => retry();
            expect(fails).to.throw(SyntaxError);
        });

        it('should throw on negative retries', function () {
            const fails = () => retry(() => { }, -5);
            expect(fails).to.throw(RangeError);
        });

        it('should not throw if callback succeeds during retry', function () {
            let counter = 0;

            const sucessful = retry(() => {
                counter += 1;

                if (counter < 2) {
                    throw new Error('Odd');
                }

                return 'Finally!';
            }, 2);

            expect(sucessful).to.not.throw();
        });

        it('should throw if callback consistently fails', function () {
            const consistentFailure = retry(() => {
                throw new RangeError('I always fail...');
            }, 5);

            expect(consistentFailure).to.throw(RangeError);
        });

    });

});