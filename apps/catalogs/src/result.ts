import Datastore = require("@google-cloud/datastore");
import {NomadRTE} from "@ignition/nomad";

import {CatalogsEffect} from "./effects";

export type CatalogsResult<L, R> = NomadRTE<Datastore, CatalogsEffect, L, R>
