import Datastore = require("@google-cloud/datastore");
import * as grpc from "grpc";
// @ts-ignore
import {CatalogManagerService} from "../generated/catalogs_grpc_pb";
import * as messages from "../generated/catalogs_pb";

import {retrieveCatalog as retrieveCatalogInner} from "./catalog.retrieve.handler";
import {Either} from "fp-ts/lib/Either";


function handleResult<Res>(callback: grpc.sendUnaryData<Res>): (either: Either<grpc.ServiceError, Res>) => void {
    return (either: Either<grpc.ServiceError, Res>) =>
        either.fold(
            (error: grpc.ServiceError) => callback(error, null),
            (res: Res) => callback(null, res),
        );
}

function handleError<Res>(callback: grpc.sendUnaryData<Res>): (error: any) => void {
    return (error: any) => {
        callback({
            name: "Internal Error",
            message: error.toString(),
            code: grpc.status.INTERNAL
        }, null);
    };
}

const service = {
    retrieveCatalog: (call: grpc.ServerUnaryCall<messages.RetrieveCatalogRequest>, callback: grpc.sendUnaryData<messages.Catalog>) =>
        retrieveCatalogInner(call.request, new Datastore())
            .subscribe(handleResult(callback), handleError(callback))
};


// hack to include source-map-support in runtime
// noinspection TsLint
require("source-map-support").install();

function main() {
    const port = '0.0.0.0:50051';

    const server = new grpc.Server();
    server.addService(CatalogManagerService, service);
    server.bind(port, grpc.ServerCredentials.createInsecure());
    server.start();
    console.log(`Started gRPC service on ${port}`);
}

main();
