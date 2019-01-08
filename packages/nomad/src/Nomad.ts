export const URI = "Nomad";
export type URI = typeof URI

export class Nomad<T> {
    readonly _URI!: URI;

    constructor(readonly effects: ReadonlyArray<T>) {
    }

    concat(effect: T): Nomad<T> {
        return new Nomad(this.effects.concat(effect));
    }
}
