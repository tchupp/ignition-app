import {Monad2} from "fp-ts/lib/Monad";

export const URI = "Nomad";
export type URI = typeof URI

declare module "fp-ts/lib/HKT" {
    interface URI2HKT2<L, A> {
        Nomad: Nomad<L, A>
    }
}

export class Nomad<L, A> {
    readonly _URI!: URI;

    constructor(readonly effects: ReadonlyArray<L>, readonly value: A) {
    }

    concat(effect: L | ReadonlyArray<L>): Nomad<L, A> {
        return new Nomad(this.effects.concat(effect), this.value);
    }

    concatL(effectL: () => L | ReadonlyArray<L>): Nomad<L, A> {
        return new Nomad(this.effects.concat(effectL()), this.value);
    }

    map<B>(f: (a: A) => B): Nomad<L, B> {
        return new Nomad(this.effects, f(this.value));
    }

    ap<B>(fab: Nomad<L, (a: A) => B>): Nomad<L, B> {
        let b = fab.value(this.value);
        return new Nomad(this.effects.concat(fab.effects), b);
    }

    chain<B>(f: (a: A) => Nomad<L, B>): Nomad<L, B> {
        const b = f(this.value);
        return new Nomad(this.effects.concat(b.effects), b.value);
    }
}

const map = <L, A, B>(fa: Nomad<L, A>, f: (a: A) => B): Nomad<L, B> =>
    fa.map(f);

const of = <L, A>(value: A): Nomad<L, A> =>
    new Nomad<L, A>([], value);

const ap = <L, A, B>(fab: Nomad<L, (a: A) => B>, fa: Nomad<L, A>): Nomad<L, B> =>
    fa.ap(fab);

const chain = <L, A, B>(fa: Nomad<L, A>, f: (a: A) => Nomad<L, B>): Nomad<L, B> =>
    fa.chain(f);

export const nomad: Monad2<URI> = {
    URI,
    map,
    ap,
    of,
    chain
};
