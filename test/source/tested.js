class BaseClassLine { }
class BaseClass {
    constructor() {

    }
}

    class BaseClassTabbed {
        constructor() {

        }
    }

class BaseClassSpaced {
    constructor() {

    }
}

class ChildClassLine extends BaseClass { }
class ChildClass extends BaseClass {
    constructor() {

    }
}

async function asynchronous() {
    const doSomethingAsync = await new Promise((r, j) => {
        setTimeout(r, 1000);
    });
}

    async function asyncTabbed() {
        const fetchSomething = fetch('someDomain', {
            method: 'GET',
            keepalive: false
        });
    }

function synchronous() {
    const somethingSync = [1, 2, 3, 4, 5].map(x => x * x);
}

function withArgs(a,b,c) {
    return a + (b / c);
}

        function withSpacesAndArgs (d,e,f) {
            return d - (e * f);
        }

const constVar = () => console.warn('Be warned!');

let letVar = function () {
    const rand = Math.floor(Math.random() * 2);

    const mood = new Map()
        .set(0, () => 'Sometimes I feel blue')
        .set(1, () => 'But other times I cheer!');

    return mood.get(rand);
};

var varVar = 42;

        const constSpaced = 'Ground Control to Major...';

                let letSpaced = '...Tom. Can you hear me...';

            var varSpaced = '..., Major Tom?';

const functionWithNestedFuncions = function () {

    function nested() {
        const inner = 'This should be unreachable';
    }

}