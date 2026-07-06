export function readServiceMapEntriesQuery(requestOrUrl, options = {}) {
  const url = new URL(typeof requestOrUrl === "string" ? requestOrUrl : requestOrUrl.url);
  const canPreviewReviewEntries = options.canPreviewReviewEntries === true;
  const requestedReviewPreview = url.searchParams.get("includeNeedsReview") === "1";
  const requestedUnlocatedPreview = url.searchParams.get("includeUnlocated") === "1";

  return {
    keyword: url.searchParams.get("q") || url.searchParams.get("keyword") || "",
    municipalityId: url.searchParams.get("municipalityId") || "",
    municipalityName: url.searchParams.get("municipality") || url.searchParams.get("municipalityName") || "",
    county: url.searchParams.get("county") || "",
    type: url.searchParams.get("type") || "",
    includeUnlocated: canPreviewReviewEntries && requestedUnlocatedPreview,
    includeNeedsReview: canPreviewReviewEntries && requestedReviewPreview,
    limit: url.searchParams.get("limit") || ""
  };
}
