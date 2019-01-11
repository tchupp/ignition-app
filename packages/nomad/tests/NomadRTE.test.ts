import test from "ava";
import {nomad, Nomad} from "../src/Nomad";
import {NomadTE} from "../src/NomadTE";
import {NomadRTE, nomadRTE} from "../src/NomadRTE";
import {fromLeft as taskEitherFromLeft, taskEither} from "fp-ts/lib/TaskEither";

test("concat", async t => {
    const actual = new NomadRTE(() => new NomadTE(new Nomad([1], taskEither.of("hold dis"))))
        .concat(2);

    const expected = new NomadRTE(() => new NomadTE(new Nomad([1, 2], taskEither.of("hold dis"))));
    t.deepEqual(await actual.run({}), await expected.run({}));
});

test("concatL", async t => {
    const actual = new NomadRTE(() => new NomadTE(new Nomad([1], taskEither.of("hold dis"))))
        .concatL(() => 2);

    const expected = new NomadRTE(() => new NomadTE(new Nomad([1, 2], taskEither.of("hold dis"))));
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
    const initial = new NomadRTE(() => new NomadTE(nomad.of(taskEitherFromLeft<string, string>("hold dis, left"))));
    const expected = new NomadRTE(() => new NomadTE(nomad.of(taskEitherFromLeft<string, number>("hold dis, left"))));

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

    const expected = new NomadRTE(() => new NomadTE(nomad.of(taskEither.of("hold dis"))));
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
    const initial = new NomadRTE(() => new NomadTE(new Nomad([1], taskEither.of("world"))));
    const expected = new NomadRTE(() => new NomadTE(new Nomad([1/*, 2*/], taskEither.of("hello, world!"))));

    {
        let actual = initial.chain(a => nomadRTE.of<{}, number, {}, string>(`hello, ${a}!`).concat(2));
        t.deepEqual(await expected.run({}), await actual.run({}));
    }
    {
        let actual = nomadRTE.chain(initial, a => nomadRTE.of<{}, number, {}, string>(`hello, ${a}!`).concat(2));
        t.deepEqual(await expected.run({}), await actual.run({}));
    }
    {
        let actual = initial
            .map(a => `hello, ${a}!`)/*
            .concat(2)*/;
        t.deepEqual(await expected.run({}), await actual.run({}));
    }
});
