"use client"

/**
 * Koostatud teksti leht (/documents/artifacts/<id>): AI koostatud mustand või
 * kinnitatud tekst. Siia tullakse dokumentide loendist („Ava tekst”) ja
 * koostamisruumist.
 *
 * KUJU (09.10, omaniku reeglid). Leht oli vanal ühisel kihil: tume kaart
 * klaaspaneeli sees, selle sees lehe pealkiri ja siis ühes veerus kõik korraga
 * (seis, pealkirja ja sisu väljad, viis nuppu reas, jagamine, mall, allikad).
 * Nüüd on see sammulaval (`components/stage/StepFlight.jsx`) samade klotsidega
 * mis dokumentide leht. Osad ei ole järjestikused sammud, seepärast annab leht
 * lavale `parts`:
 *  - Tekst: mustandil pealkiri ja tekst toimetamiseks, kinnitatud tekstil
 *    lugemiseks. Leht avaneb siin. Pikk tekst kerib kogu paneeli.
 *  - Kinnitamine (ainult mustandil): kinnitatud teksti ei saa enam muuta,
 *    seepärast küsib nupp teist vajutust.
 *  - Andmed ja tegevused: sama vaade, mis dokumentide lehe avatud dokument
 *    (faktid, allalaadimine, kustutamine teise vajutusega).
 *  - Jagamine ruumi (ainult kinnitatud kohtumise kokkuvõttel ja neile, kes
 *    jagada tohivad): ./MeetingSummaryRoomShare.jsx.
 *  - Allikad: mall ja failid, millest tekst koostati.
 *
 * KAKS VAADET, ÜKS TEKST. Salvestamine (vaade „Tekst”) ja kinnitamine saadavad
 * mõlemad pealkirja ja teksti nii, nagu need väljadel on: kinnitus peab
 * kinnitama täpselt selle, mida inimene nägi (üks päring, vt allpool).
 * Kinnitamise vaade ütleb, kui väljadel on salvestamata muudatusi.
 *
 * Siin on andmed, päringud ja see, mis vaateid olekuga seob. Vaated on failis
 * ./detail/DetailViews.jsx, reeglid failis ./detail/detailModel.js.
 */

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"

import { useI18n } from "@/components/i18n/I18nProvider"
import StepFlight from "@/components/stage/StepFlight"
import { usePanelInfoSlot } from "@/components/ui/PanelInfoSlot"
import { SubpageHeader } from "@/components/ui/SubpageHeader"
import { localeHeaders } from "@/lib/documents/clientRequest"
import { setPanelLeaveGuard, twoPressLeaveGuard } from "@/lib/panelLeaveGuard"
import { pushWithTransition } from "@/lib/routeTransition"

import MeetingSummaryRoomShare from "./MeetingSummaryRoomShare"
import { ApproveView, EditView, LoadState, ReadView, SourcesView, StayNotice } from "./detail/DetailViews"
import { blockHeldPress, useHeadingFocus, useTwoPress } from "./detail/detailHooks"
import {
  RequestFailure,
  artifactDownloads,
  artifactPartKeys,
  artifactSheet,
  artifactTitle,
  canShareMeetingSummary,
  documentsHref,
  draftDirty,
  draftingHref,
  failureText,
  isDraft,
  isShareableSummary,
  serverMessage,
  sourceRows,
  wordCount
} from "./detail/detailModel"
import { ItemView } from "./workspace/DocumentsViews"
import { hasListReturn } from "./workspace/listReturn"
import styles from "./workspace/documents.module.css"

const NO_NOTICE = Object.freeze({ view: "", ok: "", error: "" })

export default function ArtifactDetailPage({ artifactId }) {
  const router = useRouter()
  const { t, locale } = useI18n()
  const { data: session, status: sessionStatus } = useSession()
  usePanelInfoSlot({ infoId: "documents", title: t("documents.artifact_detail_title") })

  const [load, setLoad] = useState({ status: "loading", error: "" })
  const [artifact, setArtifact] = useState(null)
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  /* Milline päring on teel (nupu sõnad): "save", "approve" või "delete". */
  const [pending, setPending] = useState("")
  /* Vaate enda teade: viga või õnnestumine selle vaate jaluses, kus tegevus tehti. */
  const [notice, setNotice] = useState(NO_NOTICE)
  /* Teade lava kohal: jääb ette ka siis, kui vaade vahetub. */
  const [stay, setStay] = useState(null)
  /* Ruum, kuhu kokkuvõte sellel lehel olles jagati (osa plaadi kokkuvõte). */
  const [sharedRoom, setSharedRoom] = useState("")

  /* Päring on teel: teist muutvat päringut samal ajal ei saadeta. Nuppe ega
     välju selleks välja ei lülitata: väljalülitatud nupp kaotaks fookuse. */
  const busyRef = useRef(false)
  /* Pärast kinnitamist muutub osade loend ja lava ehitatakse uuesti: siis
     avaneb see osal, kus on allalaadimine, mitte lehe algul. */
  const landRef = useRef("")
  const pageRef = useRef(null)
  const focusHeading = useHeadingFocus(pageRef)
  const confirm = useTwoPress()

  /* Keele vahetus annab uue `t` ja `locale`: laadimine ei tohi sellest uuesti
     käivituda, muidu kirjutaks see väljadel oleva salvestamata teksti üle. */
  const tRef = useRef(t)
  tRef.current = t
  const localeRef = useRef(locale)
  localeRef.current = locale

  const applyArtifact = useCallback((next) => {
    setArtifact(next)
    setTitle(next?.title || "")
    setContent(next?.content || "")
  }, [])

  const loadArtifact = useCallback(async () => {
    const say = tRef.current
    setLoad({ status: "loading", error: "" })
    try {
      const response = await fetch(`/api/documents/artifacts/${encodeURIComponent(artifactId)}`, {
        cache: "no-store",
        headers: localeHeaders(localeRef.current)
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok || !payload?.artifact?.id) {
        throw new RequestFailure(serverMessage(payload, say, say("documents.errors.load_artifact")))
      }
      applyArtifact(payload.artifact)
      setLoad({ status: "ready", error: "" })
    } catch (error) {
      setArtifact(null)
      setLoad({ status: "error", error: failureText(error, tRef.current("documents.errors.load_artifact")) })
    }
  }, [applyArtifact, artifactId])

  useEffect(() => {
    void loadArtifact()
  }, [loadArtifact])

  const draft = isDraft(artifact)
  const dirty = Boolean(artifact) && draft && draftDirty(artifact, { title, content })

  /* Salvestamata tekst: brauser küsib enne vahelehe sulgemist või lehe uuesti
     laadimist. Platvormi sees lahkumise (kiirmenüü tagasi-nool, Esc) peab kinni
     ühine värav allpool; lehe enda nupud küsivad teist vajutust ise (`leaving`). */
  useEffect(() => {
    if (!dirty) return undefined
    const warn = (event) => {
      event.preventDefault()
      event.returnValue = ""
    }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [dirty])

  /* Kiirmenüü tagasi-nool ja Esc ei ole selle lehe nupud: varem viisid need
     salvestamata mustandi juurest ära ilma küsimata ja tekst oli läinud. Esimene
     vajutus jääb nüüd kinni ja lava kohal seisab põhjus; teine vajutus lahkub. */
  useEffect(() => {
    if (!dirty) return undefined
    const leave = twoPressLeaveGuard({
      onAsk: () => setStay({ key: "leave", tone: "risk", text: t("documents.detail.leave_asked") }),
      onClear: () => setStay((current) => (current?.key === "leave" ? null : current))
    })
    const release = setPanelLeaveGuard(leave)
    return () => {
      release()
      leave.clear()
    }
  }, [dirty, t])

  /* Kinnitamine muudab osade loendit ja lava ehitatakse uuesti: nupp, millel
     fookus oli, kaob. Fookus läheb avaneva vaate pealkirjale. */
  const draftSeen = useRef(null)
  useEffect(() => {
    if (!artifact) return undefined
    const before = draftSeen.current
    draftSeen.current = draft
    if (before === null || before === draft) return undefined
    /* Uus lava on avanenud: sihtkoht on kasutatud. */
    landRef.current = ""
    return focusHeading()
  }, [artifact, draft, focusHeading])

  /* Kirjutamine võtab vaate „Tekst” õnnestumise teate maha: „salvestatud” ei
     tohi jääda seisma teksti kõrvale, mida on pärast seda muudetud. Viga jääb
     ette kuni järgmise tegevuseni. */
  const editField = (apply) => (value) => {
    apply(value)
    setNotice((current) => (current.view === "text" && current.ok ? NO_NOTICE : current))
  }

  const onShared = useCallback(
    ({ room, approvalRequested, approvalWarn }) => {
      const say = tRef.current
      setSharedRoom(room)
      setStay(
        approvalWarn
          ? { tone: "wait", text: say("documents.meeting_summary_share.approval_failed", { room }) }
          : {
              tone: "ok",
              text: [
                say("documents.meeting_summary_share.success", { room }),
                approvalRequested ? say("documents.meeting_summary_share.approval_requested") : ""
              ]
                .filter(Boolean)
                .join(" ")
            }
      )
    },
    []
  )

  /* Üks muutev päring korraga: vajutus, mis tuleb enne eelmise vastust, jääb ära. */
  async function exclusive(name, run) {
    if (busyRef.current) return undefined
    busyRef.current = true
    setPending(name)
    try {
      return await run()
    } finally {
      busyRef.current = false
      setPending("")
    }
  }

  function saveDraft(event) {
    event?.preventDefault()
    if (!artifact || !draft) return undefined
    return exclusive("save", async () => {
      const sent = { title, content }
      setNotice(NO_NOTICE)
      try {
        const response = await fetch(`/api/documents/artifacts/${encodeURIComponent(artifactId)}`, {
          method: "PATCH",
          headers: localeHeaders(locale, { "Content-Type": "application/json" }),
          // Versioonitunnus on see, mida SEE vaade nägi: kui teine vahekaart jõudis ette,
          // saab siit 409 ja kasutaja teab, mitte ei kirjuta vaikselt üle.
          body: JSON.stringify({ ...sent, expectedUpdatedAt: artifact.updatedAt })
        })
        const payload = await response.json().catch(() => ({}))
        if (!response.ok || !payload?.artifact?.id) {
          throw new RequestFailure(serverMessage(payload, t, t("documents.artifacts.errors.update_failed")))
        }
        const next = payload.artifact
        setArtifact(next)
        /* Väljad on päringu ajal lahti. Mis vahepeal juurde kirjutati, jääb
           alles: serveri (korrastatud) tekst tuleb väljale ainult siis, kui
           seal on ikka see, mis teele läks. */
        setTitle((current) => (current === sent.title ? next.title || "" : current))
        setContent((current) => (current === sent.content ? next.content || "" : current))
        setStay(null)
        setNotice({ view: "text", ok: t("documents.feedback.saved"), error: "" })
      } catch (error) {
        setNotice({ view: "text", ok: "", error: failureText(error, t("documents.artifacts.errors.update_failed")) })
      }
    })
  }

  /* Siia jõuab alles teine vajutus (vt `confirm.action`). */
  function approveArtifact() {
    if (!artifact || !draft) return undefined
    return exclusive("approve", async () => {
      setNotice(NO_NOTICE)
      setStay(null)
      try {
        // ÜKS päring: salvestus ja kinnitus olid varem kaks eraldi HTTP-toimingut ja nende
        // vahele mahtus terve võistlus. Nüüd kinnitatakse täpselt see versioon ja see sisu,
        // mida kasutaja siin nägi, või ei kinnitata midagi.
        // Lehe keel läheb kaasa: kinnitatud failide sildid ja teksti liigi nimi on selles keeles.
        const response = await fetch(`/api/documents/artifacts/${encodeURIComponent(artifactId)}/approve`, {
          method: "POST",
          headers: localeHeaders(locale, { "Content-Type": "application/json" }),
          body: JSON.stringify({ title, content, expectedUpdatedAt: artifact.updatedAt })
        })
        const payload = await response.json().catch(() => ({}))
        if (!response.ok || !payload?.artifact?.id) {
          throw new RequestFailure(serverMessage(payload, t, t("documents.artifacts.errors.approve_failed")))
        }
        landRef.current = "sheet"
        applyArtifact(payload.artifact)
        setStay({
          tone: "ok",
          text: t(artifactDownloads(payload.artifact).pdfMissing ? "documents.detail.approve.done_no_pdf" : "documents.feedback.approved")
        })
      } catch (error) {
        setNotice({ view: "approve", ok: "", error: failureText(error, t("documents.artifacts.errors.approve_failed")) })
      }
    })
  }

  /* Mustandil kopeeritakse see, mis väljal näha on, mitte viimati salvestatud seis. */
  async function copyContent() {
    try {
      await navigator.clipboard.writeText(String((draft ? content : artifact?.content) || ""))
      setNotice({ view: "text", ok: t("documents.feedback.copied"), error: "" })
    } catch {
      setNotice({ view: "text", ok: "", error: t("documents.errors.copy_failed") })
    }
  }

  /* Kes tuli loendist, läheb tagasi tavalisele dokumentide lehele: see kasutab
     tagasituleku märgi ära ja avab loendi sama filtriga, millega lahkuti.
     Süvalink koostatud tekstide filtriga on neile, kes tulid mujalt
     (koostamisruum, vestlus); see jätaks märgi alles ja järgmine tavaline
     külastus avaneks loendis. Loetakse vajutuse ajal, mitte lehe laadimisel. */
  const listTarget = () => documentsHref(locale, { artifacts: !hasListReturn() })

  /* Kustutamine on jäädav. Siia jõuab alles teine vajutus. */
  function deleteArtifact() {
    return exclusive("delete", async () => {
      setNotice(NO_NOTICE)
      try {
        const response = await fetch(`/api/documents/artifacts/${encodeURIComponent(artifactId)}`, {
          method: "DELETE",
          headers: localeHeaders(locale)
        })
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) {
          throw new RequestFailure(serverMessage(payload, t, t("documents.errors.delete_artifact_failed")))
        }
        /* Teksti enam ei ole: tagasi koostatud tekstide loendisse. */
        pushWithTransition(router, listTarget())
      } catch (error) {
        setNotice({ view: "sheet", ok: "", error: failureText(error, t("documents.errors.delete_artifact_failed")) })
      }
    })
  }

  const goList = () => pushWithTransition(router, listTarget())
  const back = { label: t("documents.back_to_documents"), onClick: goList }

  /* Lehelt lahkumine salvestamata tekstiga küsib teist vajutust: väljadel olev
     tekst läheks kaotsi ja seda tagasi ei saa. Vana leht mustandi juurest
     mujale ei viinud; need teed (tagasi, koostamisruum) on uued. */
  const leaving = (key, label, go) =>
    dirty
      ? confirm.action(`leave:${key}`, {
          label,
          armedLabel: t("documents.detail.leave_confirm"),
          note: t("documents.detail.unsaved_leave"),
          run: go
        })
      : { label, armed: false, note: "", onClick: go }

  function renderStage() {
    const shownTitle = artifactTitle(artifact, t)
    const shareable = isShareableSummary(artifact) && canShareMeetingSummary(session?.user)
    const partKeys = artifactPartKeys({ draft, shareable })
    const downloads = artifactDownloads(artifact)
    const sheet = artifactSheet(artifact, { t, locale })
    const { template, sources } = sourceRows(artifact, { t, locale })
    const words = wordCount(draft ? content : artifact.content)
    const noticeFor = (view) => (notice.view === view ? notice : NO_NOTICE)
    /* Jaluse rida: viga, viimase tegevuse teade või salvestamata muudatused. */
    const footFor = (view, { unsaved = false } = {}) => {
      const own = noticeFor(view)
      if (own.error) return { note: own.error, tone: "risk" }
      if (own.ok) return { note: own.ok, tone: "ok" }
      return { note: unsaved ? t("documents.detail.unsaved") : "", tone: "ok" }
    }

    const stepState = {
      text: words ? "done" : "empty",
      approve: "empty",
      sheet: "done",
      share: sharedRoom ? "done" : "empty",
      sources: sources.length ? "done" : "empty"
    }
    const stepSummary = {
      text: dirty ? t("documents.detail.unsaved") : words ? t("documents.detail.summary.words", { count: words }) : t("documents.detail.summary.empty_text"),
      approve: t("documents.detail.summary.approve"),
      sheet: [sheet.type, ...sheet.chips.map((chip) => chip.text)].filter(Boolean).join(" · "),
      share: sharedRoom ? t("documents.detail.summary.shared", { room: sharedRoom }) : t("documents.detail.summary.share"),
      sources: sources.length ? t("documents.sources_label", { count: sources.length }) : t("documents.empty_sources")
    }
    const steps = partKeys.map((key) => ({
      key,
      label: t(`documents.detail.views.${key}.title`),
      short: t(`documents.detail.views.${key}.short`),
      state: stepState[key],
      summary: stepSummary[key],
      /* Kinnitatud tekst ja allikate loend võivad olla pikad: nende järgi
         ühist kõrgust ei võeta ja siis kerib kogu paneel. Mustandi toimetamise
         vaade mahub paneeli (tekst kerib väljas), et salvestamine oleks näha. */
      free: (key === "text" && !draft) || key === "sources"
    }))

    const renderPart = (step, _index, flight) => {
      const glow = flight?.isActive !== false
      switch (step.key) {
        case "approve":
          return (
            <ApproveView
              t={t}
              title={shownTitle}
              unsaved={dirty}
              empty={!String(content || "").trim()}
              approving={pending === "approve"}
              glow={glow}
              {...footFor("approve")}
              confirm={confirm.action("approve", {
                label: t("documents.actions.approve"),
                armedLabel: t("documents.detail.approve.confirm"),
                note: t("documents.detail.approve.confirm_note"),
                run: () => void approveArtifact()
              })}
            />
          )

        case "sheet": {
          const actions = []
          if (downloads.docx) actions.push({ key: "docx", label: t("documents.actions.download_docx"), variant: "primary", href: downloads.docx })
          if (downloads.pdf) actions.push({ key: "pdf", label: t("documents.actions.download_pdf"), href: downloads.pdf })
          if (draft) {
            const toDrafting = leaving("drafting", t("documents.detail.open_drafting"), () => pushWithTransition(router, draftingHref(artifact, locale)))
            actions.push({ key: "drafting", label: toDrafting.label, onClick: toDrafting.onClick })
          }
          const toList = leaving("sheet", back.label, goList)
          actions.push({ key: "back", label: toList.label, variant: "linkBrand", onClick: toList.onClick })
          const own = noticeFor("sheet")
          return (
            <ItemView
              t={t}
              title={t("documents.detail.views.sheet.title")}
              notice={{ ok: own.ok, error: own.error, onClose: () => setNotice(NO_NOTICE) }}
              /* Mustandis on salvestamata muudatusi: märkus ütleb, miks siit
                 lahkuvad tegevused (koostamisruum, tagasi) küsivad teist vajutust. */
              sheet={dirty ? { ...sheet, note: t("documents.detail.unsaved_leave") } : sheet}
              rename={null}
              share={null}
              analysis={null}
              actions={actions}
              danger={confirm.action("delete", {
                label: t("documents.actions.delete"),
                armedLabel: t("documents.views.confirm_delete"),
                note: t("documents.confirm.delete_artifact"),
                run: () => void deleteArtifact()
              })}
            />
          )
        }

        case "share":
          return <MeetingSummaryRoomShare artifactId={artifactId} title={shownTitle} glow={glow} onShared={onShared} />

        case "sources":
          return <SourcesView t={t} template={template} sources={sources} unsaved={dirty} />

        default: {
          if (!draft) {
            return (
              <ReadView
                t={t}
                title={shownTitle}
                text={String(artifact.content || "")}
                {...footFor("text")}
                /* Allalaadimine on teksti juures, nagu vanal lehel: kinnitatud
                   teksti avaja tuleb enamasti just faili järele. */
                actions={[
                  { key: "back", label: back.label, variant: "linkBrand", onClick: back.onClick },
                  { key: "copy", label: t("documents.actions.copy"), onClick: () => void copyContent() },
                  ...(downloads.pdf ? [{ key: "pdf", label: t("documents.actions.download_pdf"), href: downloads.pdf }] : []),
                  ...(downloads.docx ? [{ key: "docx", label: t("documents.actions.download_docx"), variant: "primary", href: downloads.docx }] : [])
                ]}
              />
            )
          }
          const toList = leaving("text", back.label, goList)
          return (
            <EditView
              t={t}
              title={title}
              onTitle={editField(setTitle)}
              content={content}
              onContent={editField(setContent)}
              saving={pending === "save"}
              glow={glow}
              {...footFor("text", { unsaved: dirty })}
              hint={t("documents.draft_notice")}
              onSave={saveDraft}
              onCopy={() => void copyContent()}
              back={toList}
            />
          )
        }
      }
    }

    const landIndex = partKeys.indexOf(landRef.current)
    return (
      <>
        <StayNotice t={t} notice={stay} onClose={() => setStay(null)} />
        {/* Osade loend muutub, kui mustand kinnitatakse: siis ehitatakse lava
            uuesti ja see avaneb osal, kuhu `landRef` näitab. */}
        <StepFlight
          key={partKeys.join("|")}
          label={t("documents.artifact_detail_title")}
          steps={steps}
          parts
          texts={{
            all: t("documents.views.all"),
            position: (current, total, label) => t("documents.views.position", { current, total, label })
          }}
          initialIndex={Math.max(0, landIndex)}
          /* Teise vajutuse küsimus (kinnita, kustuta, lahku) käib selle osa
             kohta, kus see küsiti. Teises osas käies võis tekst muutuda: tagasi
             tulles algab küsimus otsast, mitte üks vajutus ei kinnita muudetud
             teksti. */
          onStepChange={confirm.disarm}
        >
          {renderPart}
        </StepFlight>
      </>
    )
  }

  return (
    <section>
      <div className={styles.page} data-dock-scroll-behavior="recede" ref={pageRef} onKeyDownCapture={blockHeldPress}>
        {/* Lehe nimi on kiirmenüüs; pealkiri jääb ekraanilugejale. */}
        <SubpageHeader showBack={false} headerClassName="sr-only">
          {t("documents.artifact_detail_title")}
        </SubpageHeader>
        {/* Jagamise osa olemasolu sõltub vaataja rollist: lava ehitatakse, kui
            sessioon on teada, muidu ehitataks see hetk hiljem uuesti. */}
        {artifact && sessionStatus !== "loading" ? (
          renderStage()
        ) : (
          <LoadState t={t} error={load.status === "error" ? load.error : ""} onRetry={() => void loadArtifact()} back={back} />
        )}
      </div>
    </section>
  )
}
