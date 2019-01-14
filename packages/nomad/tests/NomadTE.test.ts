import test from "ava";

import {fromLeft as taskEitherFromLeft, taskEither} from "fp-ts/lib/TaskEither";

import {Nomad} from "../src/Nomad";
import {fromNomad, fromTaskEither, nomadTE} from "../src/NomadTE";

test("concat", async t => {
    const actual = fromNomad(new Nomad([1], "hold dis"))
        .concat(2)
        .concat([3, 4]);

    const expected = fromNomad(new Nomad([1, 2, 3, 4], "hold dis"));
    t.deepEqual(await actual.run(), await expected.run());
});

test("concatL", async t => {
    const actual = fromNomad(new Nomad([1], "hold dis"))
        .concatL(() => 2)
        .concatL(() => [3, 4]);

    const expected = fromNomad(new Nomad([1, 2, 3, 4], "hold dis"));
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
    const initial = fromTaskEither(taskEitherFromLeft<string, string>("hold dis, left"));
    const expected = fromTaskEither(taskEitherFromLeft<string, number>("hold dis, left"));

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

    const expected = fromTaskEither(taskEither.of("hold dis"));
    t.deepEqual(await expected.run(), await actual.run());
});

test("fromTaskEither", async t => {
    const actual = fromTaskEither(taskEither.of("hold dis"));

    const expected = fromTaskEither(taskEither.of("hold dis"));
    t.deepEqual(await expected.run(), await actual.run());
});

test("NomadTE is applicative: ap", async t => {
    const fab = nomadTE.of<string, string, (n: number) => number>(n => n * 2)
        .concat("that effect");

    const initial = nomadTE.of<string, string, number>(1)
        .concat("this effect");
    const expected = nomadTE.of(2)
        .concat("this effect")
        .concat("that effect");

    t.deepEqual(await expected.run(), await initial.ap<number>(fab).run());
    t.deepEqual(await expected.run(), await nomadTE.ap(fab, initial).run());
});

test("NomadTE is a chain: chain", async t => {
    const initial = fromNomad(new Nomad([1], "world"));
    const expected = fromNomad(new Nomad([1, 2], "hello, world!"));

    const f = (a: string) => nomadTE.of<number, {}, string>(`hello, ${a}!`).concat(2);
    {
        let actual = initial.chain(f);
        t.deepEqual(await expected.run(), await actual.run());
    }
    {
        let actual = nomadTE.chain(initial, f);
        t.deepEqual(await expected.run(), await actual.run());
    }
    {
        let actual = initial
            .map(a => `hello, ${a}!`)
            .concat(2);
        t.deepEqual(await expected.run(), await actual.run());
    }
});
