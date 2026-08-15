const HIDDEN_CALL_RECORDING_STATUSES = ["DELETE_PENDING", "QUARANTINED"]

export function visibleRecordingDocumentWhere() {
  return {
    callRecordingFiles: {
      none: { status: { in: HIDDEN_CALL_RECORDING_STATUSES } }
    }
  }
}
