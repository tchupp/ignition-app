import * as grpc from "grpc";
import {sendUnaryData, ServerUnaryCall} from "grpc";
import * as messages from "../generated/catalogs_pb";
import {Catalog, GetCatalogRequest} from "../generated/catalogs_pb";
// @ts-ignore
import {CatalogManagerService} from "../generated/catalogs_grpc_pb";

/**
 * Implements the SayHello RPC method.
 */
function getCatalog(call: ServerUnaryCall<GetCatalogRequest>, callback: sendUnaryData<Catalog>) {
    const reply = new messages.Catalog();
    reply.setId('Hello ' + call.request.getCatalogId());
    callback(null, reply);
}

/**
 * Starts an RPC server that receives requests for the Greeter service at the
 * sample server port
 */
function main() {
    const server = new grpc.Server();
    server.addService(CatalogManagerService, {getCatalog: getCatalog});
    server.bind('0.0.0.0:50051', grpc.ServerCredentials.createInsecure());
    server.start();
}

main();
