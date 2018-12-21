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
import * as jspb from "google-protobuf";

type GrpcServiceErrorDetail =
    DebugInfo
    | RetryInfo
    | QuotaFailure
    | PreconditionFailure
    | BadRequest
    | RequestInfo
    | ResourceInfo
    | Help
    | LocalizedMessage

export type GrpcServiceError = {
    message: string,
    code: status,
    details: string,
    metadata?: Metadata
};

export function serviceError(message: string, code: status, details: GrpcServiceErrorDetail[]): GrpcServiceError {
    const details_pb = details.map((detail: jspb.Message) => detail.toObject());

    return {
        message: message,
        code: code,
        details: JSON.stringify(details_pb)
    };
}


export function debugInfoDetail(detail: DebugInfo.AsObject): GrpcServiceErrorDetail {
    const err = new DebugInfo();
    err.setDetail(detail.detail);
    err.setStackEntriesList(detail.stackEntriesList);
    return err;
}

export function retryInfoDetail(detail: RetryInfo.AsObject): GrpcServiceErrorDetail {
    if (detail.retryDelay) {
        const delay = new Duration();
        delay.setNanos(detail.retryDelay.nanos);
        delay.setSeconds(detail.retryDelay.seconds);

        const err = new RetryInfo();
        err.setRetryDelay(delay);
        return err;
    }

    return new RetryInfo();
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
    return err;
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
    return err;
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
    return err;
}

export function requestInfoDetail(detail: RequestInfo.AsObject): GrpcServiceErrorDetail {
    const err = new RequestInfo();
    err.setRequestId(detail.requestId);
    err.setServingData(detail.servingData);
    return err;
}

export function resourceInfoDetail(detail: ResourceInfo.AsObject): GrpcServiceErrorDetail {
    const err = new ResourceInfo();
    err.setResourceName(detail.resourceName);
    err.setResourceType(detail.resourceType);
    err.setOwner(detail.owner);
    err.setDescription(detail.description);
    return err;
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
    return err;
}

export function localizedMessageDetail(detail: LocalizedMessage.AsObject): GrpcServiceErrorDetail {
    const err = new LocalizedMessage();
    err.setLocale(detail.locale);
    err.setMessage(detail.message);
    return err;
}