export const SERVICE_MAP_SOURCE_STATUS = Object.freeze({
  OK: "ok",
  UNAVAILABLE: "unavailable",
  NOT_REQUESTED: "not_requested",
  AUTH_REQUIRED: "auth_required"
});

export const SERVICE_MAP_SOURCE_ERROR = Object.freeze({
  SERVICES_UNAVAILABLE: "SERVICE_MAP_SERVICES_UNAVAILABLE",
  PEER_LISTINGS_UNAVAILABLE: "SERVICE_MAP_PEER_LISTINGS_UNAVAILABLE"
});

const ACCESS_ERROR_MESSAGES = new Set([
  "UNAUTHORIZED",
  "FORBIDDEN",
  "AUTH_REQUIRED",
  "ACCESS_DENIED",
  "api.common.unauthorized",
  "api.common.forbidden"
]);
const SOURCE_PERMISSION_CODES = new Set(["P1000", "P1010", "28000", "28P01", "42501"]);

function errorCodes(error) {
  const driver = error?.meta?.driverAdapterError?.cause;
  return [
    error?.code,
    error?.messageKey,
    error?.cause?.code,
    driver?.code,
    driver?.originalCode
  ].map((value) => String(value || "").trim()).filter(Boolean);
}

export function isServiceMapAccessError(error) {
  const status = Number(error?.status || error?.statusCode || 0);
  const codes = errorCodes(error);
  const message = String(error?.message || "").trim();
  return status === 401 || status === 403 || codes.some((code) => ACCESS_ERROR_MESSAGES.has(code)) || ACCESS_ERROR_MESSAGES.has(message);
}

export function isServiceMapSourcePermissionError(error) {
  return errorCodes(error).some((code) => SOURCE_PERMISSION_CODES.has(code));
}

function sourceOk(value) {
  if (Array.isArray(value)) return { entries: value, page: null };
  if (!value || typeof value !== "object" || !Array.isArray(value.entries)) {
    const error = new Error("SERVICE_MAP_SOURCE_INVALID_RESULT");
    error.code = "SERVICE_MAP_SOURCE_INVALID_RESULT";
    throw error;
  }
  return {
    ...(value && typeof value === "object" ? value : {}),
    entries: Array.isArray(value?.entries) ? value.entries : [],
    page: value?.page || null
  };
}

function unavailableError(failures) {
  const error = new Error("SERVICE_MAP_SOURCES_UNAVAILABLE");
  error.code = "SERVICE_MAP_SOURCES_UNAVAILABLE";
  error.status = 503;
  error.failures = failures;
  return error;
}

function settleRequestedSource({ requested, settled, errorCode }) {
  if (!requested) {
    return {
      result: { entries: [], page: null },
      state: { status: SERVICE_MAP_SOURCE_STATUS.NOT_REQUESTED, errorCode: null },
      failure: null
    };
  }
  if (settled?.status === "fulfilled") {
    try {
      return {
        result: sourceOk(settled.value),
        state: { status: SERVICE_MAP_SOURCE_STATUS.OK, errorCode: null },
        failure: null
      };
    } catch (error) {
      return {
        result: { entries: [], page: null },
        state: { status: SERVICE_MAP_SOURCE_STATUS.UNAVAILABLE, errorCode },
        failure: error
      };
    }
  }
  if (isServiceMapAccessError(settled?.reason)) throw settled.reason;
  if (isServiceMapSourcePermissionError(settled?.reason)) throw settled.reason;
  return {
    result: { entries: [], page: null },
    state: { status: SERVICE_MAP_SOURCE_STATUS.UNAVAILABLE, errorCode },
    failure: settled?.reason || new Error(errorCode)
  };
}

export function combineServiceMapSourceResults({
  servicesRequested,
  peerListingsRequested,
  peerListingsAuthorized,
  serviceSettled,
  peerListingsSettled
}) {
  const services = settleRequestedSource({
    requested: servicesRequested,
    settled: serviceSettled,
    errorCode: SERVICE_MAP_SOURCE_ERROR.SERVICES_UNAVAILABLE
  });
  const peerListings = peerListingsRequested && !peerListingsAuthorized
    ? {
        result: { entries: [], page: null },
        state: { status: SERVICE_MAP_SOURCE_STATUS.AUTH_REQUIRED, errorCode: null },
        failure: null
      }
    : settleRequestedSource({
        requested: peerListingsRequested,
        settled: peerListingsSettled,
        errorCode: SERVICE_MAP_SOURCE_ERROR.PEER_LISTINGS_UNAVAILABLE
      });

  const sources = { services: services.state, peerListings: peerListings.state };
  const technicalStates = Object.values(sources).filter(({ status }) => (
    status === SERVICE_MAP_SOURCE_STATUS.OK || status === SERVICE_MAP_SOURCE_STATUS.UNAVAILABLE
  ));
  const failures = [services.failure, peerListings.failure].filter(Boolean);
  const okCount = technicalStates.filter(({ status }) => status === SERVICE_MAP_SOURCE_STATUS.OK).length;
  const unavailableCount = technicalStates.filter(({ status }) => status === SERVICE_MAP_SOURCE_STATUS.UNAVAILABLE).length;
  if (unavailableCount > 0 && okCount === 0) throw unavailableError(failures);

  return {
    serviceResult: services.result,
    peerResult: peerListings.result,
    sources,
    partial: unavailableCount > 0,
    failures
  };
}
