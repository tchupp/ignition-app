import {task, Task} from "fp-ts/lib/Task";
import {either, Either, left as eitherLeft} from "fp-ts/lib/Either";
import {TaskEither} from "fp-ts/lib/TaskEither";

import {nomad, Nomad} from "./Nomad";
import {fromNomadTE, NomadRTE} from "./NomadRTE";

export const URI = "NomadTE";
export type URI = typeof URI

declare module 'fp-ts/lib/HKT' {
    interface URI2HKT3<U, L, A> {
        NomadTE: NomadTE<U, L, A>
    }
}

export class NomadTE<U, L, A> {
    readonly _URI!: URI;

    constructor(readonly inner: Task<Nomad<U, Either<L, A>>>) {
    }

    async run(): Promise<[Either<L, A>, ReadonlyArray<U>]> {
        const n = await this.inner.run();
        return [n.value, n.effects] as [Either<L, A>, ReadonlyArray<U>];
    }

    async eval(): Promise<Either<L, A>> {
        const n = await this.inner.run();
        return n.value;
    }

    concat(effect: U | ReadonlyArray<U>): NomadTE<U, L, A> {
        const newInner = this.inner.map(a => a.concat(effect));
        return new NomadTE(newInner);
    }

    concatL(effectL: () => U | ReadonlyArray<U>): NomadTE<U, L, A> {
        const newInner = this.inner.map(a => a.concatL(effectL));
        return new NomadTE(newInner);
    }

    map<B>(f: (a: A) => B): NomadTE<U, L, B> {
        const newInner = this.inner.map(value => value.map(either => either.map(a => f(a))));
        return new NomadTE(newInner);
    }

    mapLeft<M>(f: (l: L) => M): NomadTE<U, M, A> {
        const newInner = this.inner.map(value => value.map(either => either.mapLeft(a => f(a))));
        return new NomadTE(newInner);
    }

    bimap<M, B>(f: (l: L) => M, g: (a: A) => B): NomadTE<U, M, B> {
        const newInner = this.inner.map(value => value.map(either => either.bimap(f, g)));
        return new NomadTE(newInner);
    }

    fold<R>(left: (l: L) => R, right: (a: A) => R): Task<Nomad<U, R>> {
        return this.inner.map(value => value.map(either => either.fold(left, right)));
    }

    ap<B>(fab: NomadTE<U, L, (a: A) => B>): NomadTE<U, L, B> {
        const newInner = Promise.all([this.inner.run(), fab.inner.run()])
            .then(([current, f]) => current.chain(either => f.map(ff => either.ap(ff))));

        return new NomadTE(new Task(() => newInner));
    }

    chain<B>(f: (a: A) => NomadTE<U, L, B>): NomadTE<U, L, B> {
        const newInner = this.inner.run()
            .then(async (currentInner): Promise<Nomad<U, Either<L, B>>> => {
                const either: Either<L, A> = currentInner.value;

                if (either.isLeft()) {
                    return currentInner.map(() => eitherLeft(either.value));
                } else {
                    const {effects, value} = await f(either.value).inner.run();
                    return new Nomad(currentInner.effects.concat(effects), value);
                }
            });

        return new NomadTE(new Task(() => newInner));
    }

    toNomadRTE<E>(): NomadRTE<E, U, L, A> {
        return fromNomadTE(this);
    }
}

export const fromTaskEither = <U, L, A>(fa: TaskEither<L, A>): NomadTE<U, L, A> =>
    new NomadTE(fa.value.map(a => nomad.of(a)));

export const fromNomad = <U, L, A>(f: Nomad<U, A>): NomadTE<U, L, A> =>
    new NomadTE(task.of(f.map(a => either.of(a))));

export const left = <U, L, A>(l: L): NomadTE<U, L, A> =>
    new NomadTE(task.of(nomad.of(eitherLeft(l))));

const map = <U, L, A, B>(fa: NomadTE<U, L, A>, f: (a: A) => B): NomadTE<U, L, B> =>
    fa.map(f);

const of = <U, L, A>(value: A): NomadTE<U, L, A> =>
    new NomadTE(task.of(nomad.of(either.of(value))));

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
