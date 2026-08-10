import { prisma } from "@/lib/prisma"
import { createArtifactError } from "@/lib/documents/artifacts"

/**
 * ARTEFAKTI TINGIMUSLIK MUUTMINE JA KINNITAMINE (SOL-DOC-03).
 *
 * MIS OLI VALESTI. Nii PATCH kui approve LUGESID artefakti seisu eraldi päringuga ja
 * kontrollisid mälus, et ta on `DRAFT` — aga hilisem kirjutus sihtis ainult `where: { id }`.
 * Kahe vahekaardi tavaline kasutus piisas vastuolu tekitamiseks: kui PATCH luges `DRAFT`,
 * approve commit'is vahepeal `FINAL`, ja PATCH siis jätkas, muutis ta **juba kinnitatud rea
 * sisu**. Allalaaditav „lõplik" dokument võis pärast kinnitamise aega muutuda ning
 * kinnitusaudit ei kirjeldanud enam seda sisu, mille kasutaja kinnitas.
 *
 * MIS SIIN ON. Kontroll ja kirjutus on ÜKS lause. `updateMany` tingimus kannab kõike, mis
 * peab kehtima kirjutamise HETKEL — `id + ownerId + status + oodatud versioon` — ja
 * `count === 0` tähendab, et üks neist ei kehtinud enam. Mälus loetud seis ei otsusta enam
 * midagi; ta on ainult veateate täpsustamiseks, PÄRAST kaotust.
 *
 * VERSIOON on `updatedAt`. Eraldi veergu ei ole vaja: iga kirjutus liigutab teda (`@updatedAt`)
 * ja klient saab ta vastuses kaasa. Kes kirjutab vananenud versiooni peale, kaotab.
 *
 * KINNITAMINE VÕIB SISU KAASA VÕTTA. Klient tegi varem kaks päringut — salvesta, siis kinnita
 * — ja nende vahele mahtus terve võistlus. `approveArtifact` võtab sisu vastu ja kinnitab
 * täpselt selle, mida kasutaja nägi, ühe tingimusliku lausega.
 */

const FINAL = "FINAL"
const DRAFT = "DRAFT"

export const ARTIFACT_VERSION_CONFLICT_KEY = "documents.artifacts.errors.version_conflict"

export const artifactMutationInclude = {
  template: {
    select: {
      id: true,
      title: true,
      originalName: true
    }
  },
  sourceDocuments: {
    include: {
      document: {
        select: {
          id: true,
          title: true,
          originalName: true,
          kind: true,
          templateFor: true
        }
      }
    },
    orderBy: {
      createdAt: "asc"
    }
  }
}

/** Kliendi saadetud versioonitunnus (ISO-sõne või Date) → `Date`, või null kui puudub. */
export function parseExpectedVersion(value) {
  if (value == null || value === "") return null
  const parsed = value instanceof Date ? value : new Date(String(value))
  if (Number.isNaN(parsed.getTime())) {
    throw createArtifactError("documents.errors.invalid_payload", 400)
  }
  return parsed
}

function conflict(key = ARTIFACT_VERSION_CONFLICT_KEY) {
  return createArtifactError(key, 409)
}

function notFound() {
  return createArtifactError("documents.artifacts.errors.not_found", 404)
}

async function readOwned(db, artifactId, ownerId) {
  return db.agentArtifact.findFirst({
    where: { id: artifactId, ownerId },
    include: artifactMutationInclude
  })
}

/**
 * Muudab DRAFT-artefakti ainult siis, kui ta ON veel draft JA on täpselt see versioon, mida
 * klient nägi. Kaotaja saab 409 — kinnitatud sisu ei kirjutata üle vaikselt.
 */
export async function updateDraftArtifact(
  { artifactId, ownerId, expectedUpdatedAt = null, title, content, templateId },
  { db = prisma } = {}
) {
  const data = {}
  if (title !== undefined) data.title = title
  if (content !== undefined) data.content = content
  if (templateId !== undefined) data.templateId = templateId

  const where = { id: artifactId, ownerId, status: DRAFT }
  if (expectedUpdatedAt) where.updatedAt = expectedUpdatedAt

  const { count } = await db.agentArtifact.updateMany({ where, data })
  if (count === 1) {
    return readOwned(db, artifactId, ownerId)
  }

  // Kaotasime. Alles NÜÜD loeme, et öelda kasutajale, mis täpselt juhtus.
  const current = await readOwned(db, artifactId, ownerId)
  if (!current) throw notFound()
  if (current.status === FINAL) throw conflict("documents.artifacts.errors.final_read_only")
  throw conflict()
}

/**
 * Kinnitab artefakti ühe tingimusliku lausega, valikuliselt koos kliendi viimase sisuga.
 *
 * Korduskatse on ohutu: kui rida on juba FINAL ja sisu on täpselt see, mida klient kinnitada
 * tahtis, on töö tehtud ja vastus on edu. Kui FINAL sisu on MUU, siis kinnitas keegi teine
 * midagi muud — see on konflikt, mitte edu, ja kasutaja peab seda teadma.
 */
export async function approveArtifact(
  { artifactId, ownerId, expectedUpdatedAt = null, title, content },
  { db = prisma, now = new Date() } = {}
) {
  const data = { status: FINAL, approvedAt: now }
  if (title !== undefined) data.title = title
  if (content !== undefined) data.content = content

  const where = { id: artifactId, ownerId, status: DRAFT }
  if (expectedUpdatedAt) where.updatedAt = expectedUpdatedAt

  const { count } = await db.agentArtifact.updateMany({ where, data })
  if (count === 1) {
    return { artifact: await readOwned(db, artifactId, ownerId), alreadyFinal: false }
  }

  const current = await readOwned(db, artifactId, ownerId)
  if (!current) throw notFound()

  if (current.status === FINAL) {
    if (content === undefined || current.content === content) {
      return { artifact: current, alreadyFinal: true }
    }
    throw conflict()
  }

  // Endiselt DRAFT: ainus võimalik põhjus on versiooni mittevastavus.
  throw conflict()
}
