import {fromTaskEither, nomadTE, NomadTE} from "./NomadTE";
import {Nomad} from "./Nomad";

import {fromLeft as taskEitherFromLeft, taskEither} from "fp-ts/lib/TaskEither";
import {Either} from "fp-ts/lib/Either";
import {Reader} from "fp-ts/lib/Reader";

export const URI = "NomadRTE";
export type URI = typeof URI

declare module "fp-ts/lib/HKT" {
    interface URI2HKT4<X, U, L, A> {
        NomadRTE: NomadRTE<X, U, L, A>
    }
}

export class NomadRTE<E, U, L, A> {
    readonly _URI!: URI;

    constructor(readonly inner: (e: E) => NomadTE<U, L, A>) {
    }

    run(e: E): Promise<[Either<L, A>, ReadonlyArray<U>]> {
        return this.inner(e).run();
    }

    eval(e: E): Promise<Either<L, A>> {
        return this.inner(e).eval();
    }

    concat(effect: U | ReadonlyArray<U>): NomadRTE<E, U, L, A> {
        return new NomadRTE(e => this.inner(e).concat(effect));
    }

    concatL(effectL: () => U | ReadonlyArray<U>): NomadRTE<E, U, L, A> {
        return new NomadRTE(e => this.inner(e).concatL(effectL));
    }

    map<B>(f: (a: A) => B): NomadRTE<E, U, L, B> {
        return new NomadRTE(e => this.inner(e).map(f));
    }

    mapLeft<M>(f: (l: L) => M): NomadRTE<E, U, M, A> {
        return new NomadRTE(e => this.inner(e).mapLeft(f));
    }

    bimap<M, B>(f: (l: L) => M, g: (a: A) => B): NomadRTE<E, U, M, B> {
        return new NomadRTE(e => this.inner(e).bimap(f, g));
    }

    ap<B>(fab: NomadRTE<E, U, L, (a: A) => B>): NomadRTE<E, U, L, B> {
        return new NomadRTE(e => this.inner(e).ap(fab.inner(e)));
    }

    chain<B>(f: (a: A) => NomadRTE<E, U, L, B>): NomadRTE<E, U, L, B> {
        return new NomadRTE(e => this.inner(e).chain(a => f(a).inner(e)));
    }
}

export const fromNomadTE = <X, U, L, A>(fa: NomadTE<U, L, A>): NomadRTE<X, U, L, A> =>
    new NomadRTE(() => fa);

export const fromNomad = <X, U, L, A>(fa: Nomad<U, A>): NomadRTE<X, U, L, A> =>
    new NomadRTE(() => new NomadTE(fa.map(a => taskEither.of(a))));

export const fromLeft = <X, U, L, A>(l: L): NomadRTE<X, U, L, A> =>
    fromNomadTE(fromTaskEither(taskEitherFromLeft(l)));

export const fromReader = <X, U, L, A>(fa: Reader<X, A>): NomadRTE<X, U, L, A> =>
    new NomadRTE(e => nomadTE.of(fa.run(e)));

const map = <X, U, L, A, B>(fa: NomadRTE<X, U, L, A>, f: (a: A) => B): NomadRTE<X, U, L, B> =>
    fa.map(f);

const of = <X, U, L, A>(value: A): NomadRTE<X, U, L, A> =>
    fromNomadTE(nomadTE.of(value));

const ap = <X, U, L, A, B>(fab: NomadRTE<X, U, L, (a: A) => B>, fa: NomadRTE<X, U, L, A>): NomadRTE<X, U, L, B> =>
    fa.ap(fab);

const chain = <X, U, L, A, B>(fa: NomadRTE<X, U, L, A>, f: (a: A) => NomadRTE<X, U, L, B>): NomadRTE<X, U, L, B> =>
    fa.chain(f);


export const nomadRTE = {
    URI,
    map,
    ap,
    of,
    chain
};
