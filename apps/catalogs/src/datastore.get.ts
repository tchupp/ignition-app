import Datastore = require("@google-cloud/datastore");
import {DatastoreKey} from "@google-cloud/datastore/entity";

import {tryCatch} from "fp-ts/lib/TaskEither";
import {fromNullable, Option} from "fp-ts/lib/Option";
import {ReaderTaskEither} from "fp-ts/lib/ReaderTaskEither";

import {DatastoreError} from "./datastore.error";

export function get(key: DatastoreKey): ReaderTaskEither<Datastore, DatastoreError, Option<object>> {
    return new ReaderTaskEither(datastore =>
        tryCatch(() => datastore.get(key), (err: any) => err as DatastoreError)
            .map(res => fromNullable(res[0]))
    );
}
