import {
    BadRequest,
    DebugInfo,
    Help,
    LocalizedMessage,
    PreconditionFailure,
    QuotaFailure,
    RequestInfo,
    ResourceInfo,
    RetryInfo
} from "../generated/google/rpc/error_details_pb";

import {Metadata, status} from "grpc";
import {Duration} from "google-protobuf/google/protobuf/duration_pb";
import {Any} from "google-protobuf/google/protobuf/any_pb";
import {Status} from "../generated/google/rpc/status_pb";

type GrpcServiceErrorDetail =
    { type: "DebugInfo", detail: DebugInfo }
    | { type: "RetryInfo", detail: RetryInfo }
    | { type: "QuotaFailure", detail: QuotaFailure }
    | { type: "PreconditionFailure", detail: PreconditionFailure }
    | { type: "BadRequest", detail: BadRequest }
    | { type: "RequestInfo", detail: RequestInfo }
    | { type: "ResourceInfo", detail: ResourceInfo }
    | { type: "Help", detail: Help }
    | { type: "LocalizedMessage", detail: LocalizedMessage }

export type GrpcServiceError = {
    message: string,
    code: status,
    metadata: Metadata
};

export function serviceError(message: string, code: status, details: GrpcServiceErrorDetail[] = []): GrpcServiceError {
    const statusDetails = details.map((detail) => {
        const any = new Any();
        any.setTypeUrl(`type.googleapis.com/google.rpc.${detail.type}`);
        any.setValue(detail.detail.serializeBinary());
        return any;
    });

    const status = new Status();
    status.setMessage(message);
    status.setCode(code.valueOf());
    status.setDetailsList(statusDetails);

    const metadata = new Metadata();
    metadata.set('grpc-status-details-bin', Buffer.from(status.serializeBinary()));

    return {
        message: message,
        code: code,
        metadata: metadata
    };
}


export function debugInfoDetail(detail: DebugInfo.AsObject): GrpcServiceErrorDetail {
    const err = new DebugInfo();
    err.setDetail(detail.detail);
    err.setStackEntriesList(detail.stackEntriesList);
    return {type: "DebugInfo", detail: err};
}

export function retryInfoDetail(detail: RetryInfo.AsObject): GrpcServiceErrorDetail {
    if (detail.retryDelay) {
        const delay = new Duration();
        delay.setNanos(detail.retryDelay.nanos);
        delay.setSeconds(detail.retryDelay.seconds);

        const err = new RetryInfo();
        err.setRetryDelay(delay);
        return {type: "RetryInfo", detail: err};
    }

    return {type: "RetryInfo", detail: new RetryInfo()};
}

export function quotaFailureDetail(detail: QuotaFailure.AsObject): GrpcServiceErrorDetail {
    const violations = detail.violationsList.map(violation => {
        const v = new QuotaFailure.Violation();
        v.setSubject(violation.subject);
        v.setDescription(violation.description);
        return v;
    });

    const err = new QuotaFailure();
    err.setViolationsList(violations);
    return {type: "QuotaFailure", detail: err};
}

export function preconditionFailureDetail(detail: PreconditionFailure.AsObject): GrpcServiceErrorDetail {
    const violations = detail.violationsList.map(violation => {
        const v = new PreconditionFailure.Violation();
        v.setType(violation.type);
        v.setSubject(violation.subject);
        v.setDescription(violation.description);
        return v;
    });

    const err = new PreconditionFailure();
    err.setViolationsList(violations);
    return {type: "PreconditionFailure", detail: err};
}

export function badRequestDetail(detail: BadRequest.AsObject): GrpcServiceErrorDetail {
    const violations = detail.fieldViolationsList.map(violation => {
        const v = new BadRequest.FieldViolation();
        v.setField(violation.field);
        v.setDescription(violation.description);
        return v;
    });

    const err = new BadRequest();
    err.setFieldViolationsList(violations);
    return {type: "BadRequest", detail: err};
}

export function requestInfoDetail(detail: RequestInfo.AsObject): GrpcServiceErrorDetail {
    const err = new RequestInfo();
    err.setRequestId(detail.requestId);
    err.setServingData(detail.servingData);
    return {type: "RequestInfo", detail: err};
}

export function resourceInfoDetail(detail: ResourceInfo.AsObject): GrpcServiceErrorDetail {
    const err = new ResourceInfo();
    err.setResourceName(detail.resourceName);
    err.setResourceType(detail.resourceType);
    err.setOwner(detail.owner);
    err.setDescription(detail.description);
    return {type: "ResourceInfo", detail: err};
}

export function helpDetail(detail: Help.AsObject): GrpcServiceErrorDetail {
    const links = detail.linksList.map(violation => {
        const v = new Help.Link();
        v.setUrl(violation.url);
        v.setDescription(violation.description);
        return v;
    });

    const err = new Help();
    err.setLinksList(links);
    return {type: "Help", detail: err};
}

export function localizedMessageDetail(detail: LocalizedMessage.AsObject): GrpcServiceErrorDetail {
    const err = new LocalizedMessage();
    err.setLocale(detail.locale);
    err.setMessage(detail.message);
    return {type: "LocalizedMessage", detail: err};
}