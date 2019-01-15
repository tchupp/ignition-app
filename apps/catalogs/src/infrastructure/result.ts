import Datastore = require("@google-cloud/datastore");
import {fromReader as nomadRTEFromReader, NomadRTE} from "@ignition/nomad";

import {CatalogsEffect} from "./effects";
import {Reader} from "fp-ts/lib/Reader";

export type CatalogsResult<L, R> = NomadRTE<Datastore, CatalogsEffect, L, R>

export function fromReader<L, R>(fa: Reader<Datastore, R>) {
    return nomadRTEFromReader<Datastore, CatalogsEffect, L, R>(fa);
}