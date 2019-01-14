import test from "ava";
import {left, nomadTE} from "../src/NomadTE";
import {fromNomadTE, NomadRTE, nomadRTE} from "../src/NomadRTE";

test("concat", async t => {
    const actual = fromNomadTE(nomadTE.of("hold dis").concat(1))
        .concat(2)
        .concat([3, 4]);

    const expected = fromNomadTE(nomadTE.of("hold dis").concat([1, 2, 3, 4]));
    t.deepEqual(await actual.run({}), await expected.run({}));
});

test("concatL", async t => {
    const actual = fromNomadTE(nomadTE.of("hold dis").concat(1))
        .concatL(() => 2)
        .concatL(() => [3, 4]);

    const expected = fromNomadTE(nomadTE.of("hold dis").concat([1, 2, 3, 4]));
    t.deepEqual(await actual.run({}), await expected.run({}));
});

test("NomadRTE is a functor: URI", t => {
    t.deepEqual("NomadRTE", nomadRTE.URI);
});

test("NomadRTE is a functor: map", async t => {
    const initial = nomadRTE.of("hold dis");
    const expected = nomadRTE.of(8);

    {
        const actual = initial.map(a => a.length);
        t.deepEqual(await expected.run({}), await actual.run({}));
    }
    {
        const actual = nomadRTE.map(initial, a => a.length);
        t.deepEqual(await expected.run({}), await actual.run({}));
    }
});

test("map does not affect 'left' eithers", async t => {
    const initial: NomadRTE<{}, {}, string, string> = fromNomadTE(left("hold dis, left"));
    const expected: NomadRTE<{}, {}, string, number> = fromNomadTE(left("hold dis, left"));

    {
        const actual = initial.map(a => a.length);
        t.deepEqual(await expected.run({}), await actual.run({}));
    }
    {
        const actual = nomadRTE.map(initial, a => a.length);
        t.deepEqual(await expected.run({}), await actual.run({}));
    }
});

test("NomadRTE is applicative: of", async t => {
    const actual = nomadRTE.of("hold dis");

    const expected = fromNomadTE(nomadTE.of("hold dis"));
    t.deepEqual(await expected.run({}), await actual.run({}));
});

test("NomadRTE is applicative: ap", async t => {
    const fab = nomadRTE.of<{}, string, string, (n: number) => number>(n => n * 2);

    const initial = nomadRTE.of<{}, string, string, number>(1);
    const expected = nomadRTE.of(2);

    t.deepEqual(await expected.run({}), await initial.ap<number>(fab).run({}));
    t.deepEqual(await expected.run({}), await nomadRTE.ap(fab, initial).run({}));
});

test("NomadRTE is a chain: chain", async t => {
    const initial = nomadRTE.of<{}, number, {}, string>("world").concat(1);
    const expected = nomadRTE.of<{}, number, {}, string>("hello, world!").concat([1, 2]);

    const f = (a: string) => nomadRTE.of<{}, number, {}, string>(`hello, ${a}!`).concat(2);
    {
        let actual = initial.chain(f);
        t.deepEqual(await expected.run({}), await actual.run({}));
    }
    {
        let actual = nomadRTE.chain(initial, f);
        t.deepEqual(await expected.run({}), await actual.run({}));
    }
    {
        let actual = initial
            .map(a => `hello, ${a}!`)
            .concat(2);
        t.deepEqual(await expected.run({}), await actual.run({}));
    }
});
