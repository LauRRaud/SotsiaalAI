function isOwnedByUser(record, userId) {
  return Boolean(record?.ownerId && userId && String(record.ownerId) === String(userId))
}

export function assertOwnedByUser(record, userId) {
  if (!isOwnedByUser(record, userId)) {
    const error = new Error("api.common.forbidden")
    error.status = 403
    throw error
  }
  return record
}
