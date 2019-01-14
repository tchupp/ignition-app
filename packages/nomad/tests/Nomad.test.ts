import test from "ava";

import {nomad, Nomad} from "../src/Nomad";

test("concat", t => {
    const actual = new Nomad([1], "hold dis")
        .concat(2)
        .concat([3, 4]);

    const expected = new Nomad([1, 2, 3, 4], "hold dis");
    t.deepEqual(actual, expected);
});

test("concatL", t => {
    const actual = new Nomad([1], "hold dis")
        .concatL(() => 2)
        .concatL(() => [3, 4]);

    const expected = new Nomad([1, 2, 3, 4], "hold dis");
    t.deepEqual(actual, expected);
});

test("Nomad is a functor: URI", t => {
    {
        t.deepEqual("Nomad", nomad.URI);
    }
});

test("Nomad is a functor: map", t => {
    const initial = new Nomad([], "hold dis");
    const expected = new Nomad([], 8);

    {
        const actual = initial.map(a => a.length);
        t.deepEqual(expected, actual);
    }
    {
        const actual = nomad.map(initial, a => a.length);
        t.deepEqual(expected, actual);
    }
});

test("Nomad is applicative: of", t => {
    const actual = nomad.of("hold dis");

    const expected = new Nomad([], "hold dis");
    t.deepEqual(expected, actual);
});

test("Nomad is applicative: ap", t => {
    const fab = nomad.of<string, (n: number) => number>(n => n * 2);

    const initial: Nomad<string, number> = nomad.of<string, number>(1);
    const expected = nomad.of(2);

    t.deepEqual(expected, initial.ap<number>(fab));
    t.deepEqual(expected, nomad.ap(fab, initial));
});

test("Nomad is a chain: chain", t => {
    const initial = new Nomad([1], "world");

    const expected = new Nomad([1, 2], "hello, world!");

    {
        let actual = initial.chain(a => new Nomad([2], `hello, ${a}!`));
        t.deepEqual(expected, actual);
    }
    {
        let actual = nomad.chain(initial, a => new Nomad([2], `hello, ${a}!`));
        t.deepEqual(expected, actual);
    }
    {
        let actual = initial
            .map(a => `hello, ${a}!`)
            .concat(2);
        t.deepEqual(expected, actual);
    }
});