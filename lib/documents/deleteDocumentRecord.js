export async function deleteDocumentRecordAndFile({ deleteRecord, deleteFile, onFileDeleteError }) {
  const deletedRecord = await deleteRecord()

  try {
    await deleteFile(deletedRecord)
  } catch (error) {
    onFileDeleteError?.(error, deletedRecord)
  }

  return deletedRecord
}
