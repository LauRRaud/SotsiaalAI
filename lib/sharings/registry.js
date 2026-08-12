/**
 * Kanooniline register inimese info liikumise kohta.
 *
 * See ei ole ainult menüü: sama loend juhib „Minu jagamiste" serverivaadet,
 * andmekoopia jagamisajalugu ja nende kahe katvustesti. Uus jagamismudel või
 * uus omanikusuund peab siia jõudma enne, kui kumbki väljund saab end
 * täielikuks nimetada.
 */

export const SHARING_CLASSIFICATION = Object.freeze({
  SHARING: "SHARING",
  PRIVATE_RECORD: "PRIVATE_RECORD"
});

export const SHARING_DIRECTION = Object.freeze({
  OUTGOING: "OUTGOING",
  INCOMING_REQUEST: "INCOMING_REQUEST",
  MEMBERSHIP: "MEMBERSHIP",
  PUBLICATION: "PUBLICATION",
  PRIVATE: "PRIVATE"
});

export const SHARING_TYPE_REGISTRY = Object.freeze([
  {
    type: "PRE_INQUIRY",
    sourceModel: "PreInquiry",
    ownerField: "authorId",
    direction: SHARING_DIRECTION.OUTGOING,
    classification: SHARING_CLASSIFICATION.SHARING,
    section: "preInquiries",
    export: true
  },
  {
    type: "ROOM_MEMBERSHIP",
    sourceModel: "RoomMember",
    ownerField: "userId",
    direction: SHARING_DIRECTION.MEMBERSHIP,
    classification: SHARING_CLASSIFICATION.SHARING,
    section: "rooms",
    export: true
  },
  {
    type: "ROOM_SHARED_SUMMARY",
    sourceModel: "RoomSharedSummary",
    ownerField: "sharedByUserId",
    direction: SHARING_DIRECTION.OUTGOING,
    classification: SHARING_CLASSIFICATION.SHARING,
    section: "roomSummaries",
    export: true
  },
  {
    type: "ROOM_INVITE",
    sourceModel: "Invite",
    ownerField: "inviterId",
    direction: SHARING_DIRECTION.OUTGOING,
    classification: SHARING_CLASSIFICATION.SHARING,
    section: "invites",
    export: true
  },
  {
    type: "HELP_REQUEST",
    sourceModel: "HelpRequest",
    ownerField: "userId",
    direction: SHARING_DIRECTION.PUBLICATION,
    classification: SHARING_CLASSIFICATION.SHARING,
    section: "helpListings",
    export: true
  },
  {
    type: "HELP_OFFER",
    sourceModel: "HelpOffer",
    ownerField: "userId",
    direction: SHARING_DIRECTION.PUBLICATION,
    classification: SHARING_CLASSIFICATION.SHARING,
    section: "helpListings",
    export: true
  },
  {
    type: "MENTORING_PREPARATION",
    sourceModel: "MentoringPrivateNote",
    ownerField: "ownerId",
    direction: SHARING_DIRECTION.OUTGOING,
    classification: SHARING_CLASSIFICATION.SHARING,
    section: "mentoringPreparations",
    export: true
  },
  {
    type: "NETWORK_SHARE_CLIENT",
    sourceModel: "NetworkShare",
    ownerField: "clientUserId",
    direction: SHARING_DIRECTION.INCOMING_REQUEST,
    classification: SHARING_CLASSIFICATION.SHARING,
    section: "networkShares",
    export: true
  },
  {
    type: "NETWORK_SHARE_WORKER",
    sourceModel: "NetworkShare",
    ownerField: "workerId",
    direction: SHARING_DIRECTION.OUTGOING,
    classification: SHARING_CLASSIFICATION.SHARING,
    section: "outgoingNetworkShares",
    export: true
  },
  {
    type: "URGENT_REQUEST",
    sourceModel: "UrgentRequest",
    ownerField: "authorId",
    direction: SHARING_DIRECTION.OUTGOING,
    classification: SHARING_CLASSIFICATION.SHARING,
    section: "urgentRequests",
    export: true
  },
  {
    type: "WELLBEING_SUPPORT_SHARE",
    sourceModel: "WellbeingSupportShare",
    ownerField: "ownerUserId",
    direction: SHARING_DIRECTION.OUTGOING,
    classification: SHARING_CLASSIFICATION.SHARING,
    section: "wellbeingSupportShares",
    export: true
  },
  {
    type: "SERVICE_REPORT_SHARE",
    sourceModel: "ServiceReportShare",
    ownerField: "ownerUserId",
    direction: SHARING_DIRECTION.OUTGOING,
    classification: SHARING_CLASSIFICATION.SHARING,
    section: "serviceReportShares",
    export: true
  },
  {
    type: "FRAMEWORK_ACCEPTANCE",
    sourceModel: "FrameworkAcceptance",
    ownerField: "userId",
    direction: SHARING_DIRECTION.PRIVATE,
    classification: SHARING_CLASSIFICATION.PRIVATE_RECORD,
    section: "privateRecords",
    export: false
  },
  {
    type: "PRIVATE_MENTORING_PREPARATION",
    sourceModel: "MentoringPrivateNote",
    ownerField: "ownerId",
    direction: SHARING_DIRECTION.PRIVATE,
    classification: SHARING_CLASSIFICATION.PRIVATE_RECORD,
    section: "privateRecords",
    export: false
  }
]);

export const SHARING_SECTION_KEYS = Object.freeze([
  ...new Set(SHARING_TYPE_REGISTRY.map((entry) => entry.section))
]);

export const SHARING_EXPORT_TYPES = Object.freeze(
  SHARING_TYPE_REGISTRY
    .filter((entry) => entry.classification === SHARING_CLASSIFICATION.SHARING && entry.export)
    .map((entry) => entry.type)
);

export function sharingType(type) {
  return SHARING_TYPE_REGISTRY.find((entry) => entry.type === type) || null;
}
