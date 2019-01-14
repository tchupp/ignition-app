import {taskEither, TaskEither} from "fp-ts/lib/TaskEither";
import {Either} from "fp-ts/lib/Either";
import {nomad, Nomad} from "./Nomad";
import {fromNomadTE, NomadRTE} from "./NomadRTE";
import {Task} from "fp-ts/lib/Task";

export const URI = "NomadTE";
export type URI = typeof URI

declare module 'fp-ts/lib/HKT' {
    interface URI2HKT3<U, L, A> {
        NomadTE: NomadTE<U, L, A>
    }
}

export class NomadTE<U, L, A> {
    readonly _URI!: URI;

    constructor(readonly inner: Nomad<U, TaskEither<L, A>>) {
    }

    run(): Promise<[Either<L, A>, ReadonlyArray<U>]> {
        return this.eval()
            .then(value => [value, this.inner.effects] as [Either<L, A>, ReadonlyArray<U>]);
    }

    eval(): Promise<Either<L, A>> {
        return this.inner.value.run();
    }

    concat(effect: U | ReadonlyArray<U>): NomadTE<U, L, A> {
        const newInner = this.inner.concat(effect);
        return new NomadTE(newInner);
    }

    concatL(effectL: () => U | ReadonlyArray<U>): NomadTE<U, L, A> {
        const newInner = this.inner.concatL(effectL);
        return new NomadTE(newInner);
    }

    map<B>(f: (a: A) => B): NomadTE<U, L, B> {
        const newInner = this.inner.map(value => value.map(f));
        return new NomadTE(newInner);
    }

    mapLeft<M>(f: (l: L) => M): NomadTE<U, M, A> {
        const newInner = this.inner.map(value => value.mapLeft(f));
        return new NomadTE(newInner);
    }

    bimap<M, B>(f: (l: L) => M, g: (a: A) => B): NomadTE<U, M, B> {
        const newInner = this.inner.map(value => value.bimap(f, g));
        return new NomadTE(newInner);
    }

    fold<R>(left: (l: L) => R, right: (a: A) => R): Nomad<U, Task<R>> {
        return this.inner.map(e => e.fold(left, right));
    }

    ap<B>(fab: NomadTE<U, L, (a: A) => B>): NomadTE<U, L, B> {
        const newInner = this.inner
            .map(value => value.ap(fab.inner.value))
            .concat(fab.inner.effects);
        return new NomadTE(newInner);
    }

    chain<B>(f: (a: A) => NomadTE<U, L, B>): NomadTE<U, L, B> {
        const newInner = this.inner.map(value => value.chain(a => f(a).inner.value));
        return new NomadTE(newInner);
    }

    toNomadRTE<E>(): NomadRTE<E, U, L, A> {
        return fromNomadTE(this);
    }
}

export const fromTaskEither = <U, L, A>(fa: TaskEither<L, A>): NomadTE<U, L, A> =>
    new NomadTE(nomad.of(fa));

const map = <U, L, A, B>(fa: NomadTE<U, L, A>, f: (a: A) => B): NomadTE<U, L, B> =>
    fa.map(f);

const of = <U, L, A>(value: A): NomadTE<U, L, A> =>
    new NomadTE(nomad.of(taskEither.of(value)));

const ap = <U, L, A, B>(fab: NomadTE<U, L, (a: A) => B>, fa: NomadTE<U, L, A>): NomadTE<U, L, B> =>
    fa.ap(fab);

const chain = <U, L, A, B>(fa: NomadTE<U, L, A>, f: (a: A) => NomadTE<U, L, B>): NomadTE<U, L, B> =>
    fa.chain(f);

export const nomadTE = {
    URI,
    map,
    ap,
    of,
    chain
};
