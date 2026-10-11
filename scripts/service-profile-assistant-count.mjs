// Tasuta loendus (ADR-144): mitu teenuseprofiili tohiks vestluse assistendini jõuda ja mis ülejäänuid
// takistab. Ainult lugemine; väljastab arvud, mitte ühtki nime, kontakti ega teksti. Mudelit ega
// embedding'ut ei kutsuta.
//
//   node --import ./scripts/register-node-source-loader.mjs scripts/service-profile-assistant-count.mjs
//
// Serveris töötava väljalaske kaustas ja selle keskkonnafailiga (docs/rag-v2/adr-144-...md, „Loendus").
import { prisma } from "../lib/prisma.js";
import { SERVICE_AVAILABILITY_STATUSES } from "../lib/serviceAvailability.js";
import { ASSISTANT_GATE_SELECT, assistantDirectoryCounts, assistantProfileGate } from "../lib/serviceProviderAssistantGate.js";
import { publicServiceProviderServices } from "../lib/serviceProviderPublicProjection.js";

const filled = (field) => ({ AND: [{ [field]: { not: null } }, { [field]: { not: "" } }] });

try {
  const [profiles, municipalities] = await Promise.all([
    prisma.serviceProviderProfile.findMany({ select: ASSISTANT_GATE_SELECT, orderBy: { id: "asc" } }),
    prisma.municipality.findMany({ where: { isActive: true }, select: { id: true, slug: true, displayName: true, baseName: true, county: true } })
  ]);
  const counts = assistantDirectoryCounts(profiles, municipalities);

  /* Mis väljad on täidetud neil, kes assistendini jõuaksid: loeb andmebaas, väärtusi välja ei loeta. */
  const allowed = profiles.filter((profile) => assistantProfileGate(profile).allowed);
  const profileIds = allowed.map((profile) => profile.id);
  const serviceIds = allowed.flatMap((profile) => publicServiceProviderServices(profile).map((service) => service.id));
  const countProfiles = (where) => prisma.serviceProviderProfile.count({ where: { id: { in: profileIds }, ...where } });
  const countServices = (where) => prisma.serviceProviderService.count({ where: { id: { in: serviceIds }, ...where } });
  const contact = { OR: [filled("phone"), filled("email"), filled("website")] };
  const fields = {
    profiles: {
      shortDescription: await countProfiles(filled("shortDescription")),
      contact: await countProfiles(contact),
      county: await countProfiles(filled("county")),
      feeType: await countProfiles({ feeType: { not: "UNKNOWN" } })
    },
    services: {
      description: await countServices(filled("description")),
      categories: await countServices({ categories: { isEmpty: false } }),
      needTags: await countServices({ needTags: { isEmpty: false } }),
      targetGroups: await countServices({ targetGroups: { isEmpty: false } }),
      areaType: await countServices(filled("serviceAreaType")),
      municipalities: await countServices({ municipalityIds: { isEmpty: false } }),
      county: await countServices(filled("county")),
      feeType: await countServices({ feeType: { not: "UNKNOWN" } }),
      priceDescription: await countServices(filled("priceDescription")),
      availabilityStatus: await countServices({ availabilityStatus: { in: SERVICE_AVAILABILITY_STATUSES } }),
      ownContact: await countServices(contact)
    }
  };
  process.stdout.write(`${JSON.stringify({ ...counts, filledAmongAllowed: fields }, null, 2)}\n`);
} finally {
  await prisma.$disconnect();
}
