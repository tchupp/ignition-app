import {TaskEither} from "fp-ts/lib/TaskEither";

export type NomadTE<L, R> = TaskEither<L, R>

declare module 'fp-ts/lib/HKT' {
    interface URI2HKT2<L, A> {
        NomadTE: NomadTE<L, A>
    }
}

export function timedTE<L, R>(label: string, timer: () => NomadTE<L, R>): NomadTE<L, R> {
    const start = process.hrtime();

    const end = <A>(v: A): A => {
        const end = process.hrtime(start);
        console.debug(`${label} -> %dms`, (end[0] * 1000) + (end[1] / 1000000));
        return v;
    };

    return timer()
        .bimap(end, end);
}
