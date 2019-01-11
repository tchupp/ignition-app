import test from "ava";
import {nomad, Nomad} from "../src/Nomad";
import {fromTaskEither, NomadTE, nomadTE} from "../src/NomadTE";
import {fromLeft as taskEitherFromLeft, taskEither} from "fp-ts/lib/TaskEither";

test("concat", async t => {
    const actual = new NomadTE(new Nomad([1], taskEither.of("hold dis")))
        .concat(2);

    const expected = new NomadTE(new Nomad([1, 2], taskEither.of("hold dis")));
    t.deepEqual(await actual.run(), await expected.run());
});

test("concatL", async t => {
    const actual = new NomadTE(new Nomad([1], taskEither.of("hold dis")))
        .concatL(() => 2);

    const expected = new NomadTE(new Nomad([1, 2], taskEither.of("hold dis")));
    t.deepEqual(await actual.run(), await expected.run());
});

test("NomadTE is a functor: URI", t => {
    t.deepEqual("NomadTE", nomadTE.URI);
});

test("NomadTE is a functor: map", async t => {
    const initial = nomadTE.of("hold dis");
    const expected = nomadTE.of(8);

    {
        const actual = initial.map(a => a.length);
        t.deepEqual(await expected.run(), await actual.run());
    }
    {
        const actual = nomadTE.map(initial, a => a.length);
        t.deepEqual(await expected.run(), await actual.run());
    }
});

test("map does not affect 'left' eithers", async t => {
    const initial = new NomadTE(nomad.of(taskEitherFromLeft<string, string>("hold dis, left")));
    const expected = new NomadTE(nomad.of(taskEitherFromLeft<string, number>("hold dis, left")));

    {
        const actual = initial.map(a => a.length);
        t.deepEqual(await expected.run(), await actual.run());
    }
    {
        const actual = nomadTE.map(initial, a => a.length);
        t.deepEqual(await expected.run(), await actual.run());
    }
});

test("NomadTE is applicative: of", async t => {
    const actual = nomadTE.of("hold dis");

    const expected = new NomadTE(nomad.of(taskEither.of("hold dis")));
    t.deepEqual(await expected.run(), await actual.run());
});

test("fromTaskEither", async t => {
    const actual = fromTaskEither(taskEither.of("hold dis"));

    const expected = new NomadTE(nomad.of(taskEither.of("hold dis")));
    t.deepEqual(await expected.run(), await actual.run());
});

test("NomadTE is applicative: ap", async t => {
    const fab = nomadTE.of<string, string, (n: number) => number>(n => n * 2);

    const initial = nomadTE.of<string, string, number>(1);
    const expected = nomadTE.of(2);

    t.deepEqual(await expected.run(), await initial.ap<number>(fab).run());
    t.deepEqual(await expected.run(), await nomadTE.ap(fab, initial).run());
});

test("NomadTE is a chain: chain", async t => {
    const initial = new NomadTE(new Nomad([1], taskEither.of("world")));
    const expected = new NomadTE(new Nomad([1/*, 2*/], taskEither.of("hello, world!")));

    {
        let actual = initial.chain(a => nomadTE.of<number, {}, string>(`hello, ${a}!`).concat(2));
        t.deepEqual(await expected.run(), await actual.run());
    }
    {
        let actual = nomadTE.chain(initial, a => nomadTE.of<number, {}, string>(`hello, ${a}!`).concat(2));
        t.deepEqual(await expected.run(), await actual.run());
    }
    {
        let actual = initial
            .map(a => `hello, ${a}!`)/*
            .concat(2)*/;
        t.deepEqual(await expected.run(), await actual.run());
    }
});
