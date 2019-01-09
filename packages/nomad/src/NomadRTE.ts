import {ReaderTaskEither} from "fp-ts/lib/ReaderTaskEither";

export type NomadRTE<E, L, R> = ReaderTaskEither<E, L, R>

declare module "fp-ts/lib/HKT" {
    interface URI2HKT3<U, L, A> {
        NomadRTE: NomadRTE<U, L, A>
    }
}

export function timedRTE<E, L, R>(label: string, timer: () => ReaderTaskEither<E, L, R>): NomadRTE<E, L, R> {
    const start = process.hrtime();

    const end = <A>(v: A): A => {
        const end = process.hrtime(start);
        console.debug(`${label} -> %dms`, (end[0] * 1000) + (end[1] / 1000000));
        return v;
    };

    return timer()
        .bimap(end, end);
}
