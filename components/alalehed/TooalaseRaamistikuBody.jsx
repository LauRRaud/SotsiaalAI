"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/i18n/I18nProvider";
import Button from "@/components/ui/Button";
import Checkbox from "@/components/ui/Checkbox";
import { SubpageHeader } from "@/components/ui/SubpageHeader";
import Panel from "@/components/ui/Panel";
import {
  getWorkerFrameworkDocxHref,
  WORKER_FRAMEWORK_REGISTER_ACK_STORAGE_KEY,
  WORKER_FRAMEWORK_REGISTER_CONTEXT_STORAGE_KEY,
  WORKER_FRAMEWORK_REVIEW_STORAGE_KEY,
  WORKER_FRAMEWORK_SIGNED_HREF,
  WORKER_FRAMEWORK_SIGNED_DOWNLOAD_STORAGE_KEY,
  WORKER_FRAMEWORK_VERSION
} from "@/lib/frameworkAcceptances";
import { localizePath } from "@/lib/localizePath";
import { backWithTransition, pushWithTransition } from "@/lib/routeTransition";

// Funktsionaalne kerimis-konteiner: panelRef + handleShellWheel loevad scrollHeight/scrollTop.
// direct-scroll-surface = CSS/testi-viidatud kerimispinna marker; overflow/max-height = kerimis-käitumine.
const panelClassName =
  "direct-scroll-surface relative max-h-[calc(100dvh-2rem)] overflow-y-auto";

function getUpdatedFrameworkIntroCopy(locale) {
  const introCopy = {
    et: {
      introTitle: "Raamlepingu allalaadimine ja kinnitus",
      lead:
        "Laadi uus raamleping alla või loe täisteksti allpool. Kinnituse saad salvestada pärast raamlepingu ja allkirjastatud DigiDoc-faili allalaadimist.",
      paragraphs: [
        "SotsiaalAI platvormi tavapäraseks kasutamiseks ei ole eraldi raamlepingut vaja. Raamleping on mõeldud tööülesanneteks, mille käigus võib esineda isikuandmete töötlemist.",
        "Organisatsioon peab enne tööalase kasutuse lubamist määrama, kes võib SotsiaalAI-d kasutada, millistel eesmärkidel, milliseid andmeid võib sisestada ja kes kontrollib lõpptulemuse enne kasutamist üle."
      ]
    },
    en: {
      introTitle: "Framework agreement download and confirmation",
      lead:
        "Download the updated framework agreement or read the full text below. You can save the confirmation after downloading the agreement and the signed DigiDoc file.",
      paragraphs: [
        "No separate framework agreement is required for ordinary use of the SotsiaalAI platform. The framework agreement is intended for work-related tasks in the course of which personal data may be processed.",
        "Before permitting work-related use, the organisation must define who may use SotsiaalAI, for which purposes, which data may be entered, and who checks the final output before use."
      ]
    },
    ru: {
      introTitle: "Скачивание рамочного соглашения и подтверждение",
      lead:
        "Скачайте обновленное рамочное соглашение или прочитайте полный текст ниже. Подтверждение можно сохранить после скачивания соглашения и подписанного файла DigiDoc.",
      paragraphs: [
        "Для обычного использования платформы SotsiaalAI отдельное рамочное соглашение не требуется. Рамочное соглашение предназначено для рабочих задач, в ходе которых может происходить обработка персональных данных.",
        "Перед разрешением рабочего использования организация должна определить, кто может использовать SotsiaalAI, для каких целей, какие данные можно вводить и кто проверяет итоговый результат перед использованием."
      ]
    }
  };

  return Object.prototype.hasOwnProperty.call(introCopy, locale) ? introCopy[locale] : null;
}

function FrameworkBlocks({ blocks = [] }) {
  return (
    <div>
      {blocks.map((block, index) => {
        if (block.type === "heading") {
          return (
            <h3 key={`${block.type}-${index}`}>
              {block.text}
            </h3>
          );
        }

        if (block.type === "subheading") {
          return (
            <h4 key={`${block.type}-${index}`}>
              {block.text}
            </h4>
          );
        }

        if (block.type === "label") {
          if (index === 0) {
            return (
              <h3 key={`${block.type}-${index}`}>
                {block.text}
              </h3>
            );
          }

          return (
            <p key={`${block.type}-${index}`}>
              {block.text}
            </p>
          );
        }

        if (block.type === "checkOptionsRow") {
          return (
            <div key={`${block.type}-${index}`}>
              <div>
                {block.options.map((option, optionIndex) => (
                  <span key={`${index}-${optionIndex}`}>
                    <span aria-hidden="true" />
                    <span>{option}</span>
                  </span>
                ))}
              </div>
            </div>
          );
        }

        if (block.type === "checkList") {
          return (
            <div key={`${block.type}-${index}`}>
              {block.items.map((item, itemIndex) => (
                <div key={`${index}-${itemIndex}`}>
                  <span aria-hidden="true" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          );
        }

        if (block.type === "bulletList") {
          return (
            <ul key={`${block.type}-${index}`}>
              {block.items.map((item, itemIndex) => (
                <li key={`${index}-${itemIndex}`}>
                  {item}
                </li>
              ))}
            </ul>
          );
        }

        return (
          <p key={`${block.type}-${index}`}>
            {block.text}
          </p>
        );
      })}
    </div>
  );
}

function getIntroCopy(locale) {
  const updatedCopy = getUpdatedFrameworkIntroCopy(locale);
  if (updatedCopy) return updatedCopy;

  const fallbackCopy = getNormalizedIntroCopy(locale);
  const compactIntroCopy = {
    et: {
      introTitle: "Andmete töötlemise kokkuleppe allalaadimine ja kinnitus",
      lead:
        "Laadi raamleping alla või loe täisteksti allpool. Kinnituse saad salvestada pärast raamlepingu ja allkirjastatud DigiDoc-faili allalaadimist.",
      paragraphs: [
        "SotsiaalAI platvormi kasutamiseks ei ole vaja lepingut. Lepinguline raamistik on mõeldud tööülesannete jaoks, kus SotsiaalAI abil töödeldakse kliendi või muu isiku isikuandmeid."
      ]
    },
    en: {
      introTitle: "Data-processing agreement download and confirmation",
      lead:
        "Download the framework agreement or read the full text below. You can save the confirmation after downloading the agreement and the signed DigiDoc file.",
      paragraphs: [
        "You do not need an agreement to use the SotsiaalAI platform. The contractual framework is intended for work tasks where SotsiaalAI is used to process a client's or another person's personal data."
      ]
    },
    ru: {
      introTitle: "Скачивание и подтверждение соглашения об обработке данных",
      lead:
        "Скачайте рамочный договор или прочитайте полный текст ниже. Подтверждение можно сохранить после скачивания договора и подписанного файла DigiDoc.",
      paragraphs: [
        "Для использования платформы SotsiaalAI договор не требуется. Договорная рамка предназначена для рабочих задач, в которых с помощью SotsiaalAI обрабатываются персональные данные клиента или другого лица."
      ]
    }
  };

  return compactIntroCopy[locale] || {
    ...fallbackCopy,
    paragraphs: []
  };
}

function getNormalizedIntroCopy(locale) {
  if (locale === "ru") {
    return {
      introTitle: "Для чего нужен этот документ?",
      lead:
        "Документ объединяет разрешение на профессиональное использование SotsiaalAI, основные правила, подтверждение работника и соглашение об обработке данных. Прокрутите вниз, чтобы прочитать документ на сайте.",
      paragraphs: [
        "Если SotsiaalAI используется в рабочих задачах с данными клиента или другого лица, до начала работы организация должна убедиться, что использование необходимо, разрешено и соответствует ее инструкциям.",
        "Подтверждение на платформе является подтверждением на уровне пользователя. Основание профессионального использования и соглашение об обработке данных вступают в силу в объеме, указанном в рамочном договоре после его подписания сторонами."
      ]
    };
  }

  if (locale === "en") {
    return {
      introTitle: "What is this document for?",
      lead:
        "This document combines the SotsiaalAI professional-use permission, the main use rules, the worker confirmation, and the data-processing agreement. Scroll down to read the document on the web.",
      paragraphs: [
        "If SotsiaalAI is used in work tasks with client or other personal data, the organisation must first make sure that the use is necessary, permitted, and aligned with its instructions.",
        "The confirmation given in the platform is a user-level confirmation. The professional-use basis and the data-processing agreement take effect within the scope described in the framework agreement after the parties sign it."
      ]
    };
  }

  return {
    introTitle: "Milleks see dokument on?",
    lead:
      "Dokument koondab SotsiaalAI tööalase kasutuse loa, kasutamise põhireeglid, töötaja kinnituse ning andmete töötlemise kokkuleppe ühte faili. Keri alla, et dokumenti veebis lugeda.",
    paragraphs: [
      "Kui SotsiaalAI-d kasutatakse tööülesannetes kliendi või muu isiku andmetega, tuleb enne alustamist veenduda, et kasutamine on vajalik, lubatud ja organisatsiooni juhistega kooskõlas.",
      "Platvormis antav kinnitus on kasutaja tasandi kinnitus. Tööalase kasutuse alus ja andmetöötluse kokkulepe jõustuvad raamlepingus kirjeldatud ulatuses pärast poolte allkirjastamist."
    ]
  };
}

export default function TooalaseRaamistikuBody({ frameworkDocument }) {
  const router = useRouter();
  const { t, locale } = useI18n();
  const panelRef = useRef(null);
  const introCopy = getIntroCopy(locale);
  const frameworkDocxHref = getWorkerFrameworkDocxHref(locale);
  const frameworkTitle = t("auth.register.worker_framework_title");
  const [frameworkStatus, setFrameworkStatus] = useState({
    loading: true,
    authenticated: false,
    eligible: false,
    acceptance: null
  });
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [isRegisterContext, setIsRegisterContext] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [savePending, setSavePending] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveNotice, setSaveNotice] = useState("");

  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const root = document.documentElement;
    const body = document.body;

    root?.classList.add("framework-page-scroll-lock");
    body?.classList.add("framework-page-scroll-lock");

    return () => {
      root?.classList.remove("framework-page-scroll-lock");
      body?.classList.remove("framework-page-scroll-lock");
    };
  }, []);

  const loadFrameworkStatus = useCallback(async () => {
    setFrameworkStatus((current) => ({
      ...current,
      loading: true
    }));

    try {
      const response = await fetch("/api/framework-acceptances/worker", {
        cache: "no-store",
        headers: {
          "x-ui-locale": locale
        }
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.message || t("documents.framework_acceptance.load_failed"));
      }

      setFrameworkStatus({
        loading: false,
        authenticated: payload?.authenticated === true,
        eligible: payload?.eligible === true,
        acceptance: payload?.acceptance || null
      });
      setSaveError("");
    } catch (error) {
      setFrameworkStatus({
        loading: false,
        authenticated: false,
        eligible: false,
        acceptance: null
      });
      setSaveError(error?.message || t("documents.framework_acceptance.load_failed"));
    }
  }, [locale, t]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const timestamp =
      window.sessionStorage.getItem(WORKER_FRAMEWORK_REVIEW_STORAGE_KEY) || new Date().toISOString();
    window.sessionStorage.setItem(WORKER_FRAMEWORK_REVIEW_STORAGE_KEY, timestamp);
    const registerContext =
      window.sessionStorage.getItem(WORKER_FRAMEWORK_REGISTER_CONTEXT_STORAGE_KEY) === "1";
    setIsRegisterContext(registerContext);
    if (registerContext) {
      setConfirmChecked(
        window.sessionStorage.getItem(WORKER_FRAMEWORK_REGISTER_ACK_STORAGE_KEY) === "1"
      );
    }
  }, []);

  useEffect(() => {
    void loadFrameworkStatus();
  }, [loadFrameworkStatus]);

  const handleBack = () => {
    if (isClosing) return;
    setIsClosing(true);

    if (typeof window !== "undefined" && window.history.length > 1) {
      backWithTransition(router);
      return;
    }

    pushWithTransition(
      router,
      localizePath(isRegisterContext ? "/registreerimine" : "/", locale)
    );
  };

  const handleShellWheel = useCallback((event) => {
    const panel = panelRef.current;
    const target = event.target;
    if (!panel || panel.contains(target)) return;

    const maxScrollTop = panel.scrollHeight - panel.clientHeight;
    if (maxScrollTop <= 0) return;

    event.preventDefault();
    panel.scrollTop = Math.max(0, Math.min(maxScrollTop, panel.scrollTop + event.deltaY));
  }, []);

  const handleSignedDownload = () => {
    if (typeof window === "undefined") return;
    const timestamp =
      window.sessionStorage.getItem(WORKER_FRAMEWORK_SIGNED_DOWNLOAD_STORAGE_KEY) ||
      new Date().toISOString();
    window.sessionStorage.setItem(WORKER_FRAMEWORK_SIGNED_DOWNLOAD_STORAGE_KEY, timestamp);
  };

  const handleSaveAcceptance = async () => {
    if (savePending) return;

    setSavePending(true);
    setSaveError("");
    setSaveNotice("");

    try {
      if (isRegisterConfirmationMode) {
        if (typeof window !== "undefined") {
          window.sessionStorage.setItem(WORKER_FRAMEWORK_REGISTER_ACK_STORAGE_KEY, "1");
        }
        setConfirmChecked(true);
        setSaveNotice(t("documents.framework_acceptance.register_saved_notice"));
        return;
      }

      const frameworkReviewOpenedAt =
        typeof window !== "undefined"
          ? window.sessionStorage.getItem(WORKER_FRAMEWORK_REVIEW_STORAGE_KEY) || null
          : null;
      const frameworkSignedDownloadedAt =
        typeof window !== "undefined"
          ? window.sessionStorage.getItem(WORKER_FRAMEWORK_SIGNED_DOWNLOAD_STORAGE_KEY) || null
          : null;

      const response = await fetch("/api/framework-acceptances/worker", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          locale,
          frameworkReviewOpenedAt,
          frameworkSignedDownloadedAt
        })
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.message || t("documents.framework_acceptance.save_failed"));
      }

      setFrameworkStatus({
        loading: false,
        authenticated: true,
        eligible: true,
        acceptance: payload?.acceptance || null
      });
      setConfirmChecked(false);
      setSaveNotice(
        payload?.created
          ? t("documents.framework_acceptance.saved_notice")
          : t("documents.framework_acceptance.already_confirmed")
      );
    } catch (error) {
      setSaveError(error?.message || t("documents.framework_acceptance.save_failed"));
    } finally {
      setSavePending(false);
    }
  };

  const acceptance = frameworkStatus.acceptance || null;
  const isAccepted = acceptance?.accepted === true;
  const isRegisterConfirmationMode = isRegisterContext && !frameworkStatus.authenticated;
  const canConfirmFramework = frameworkStatus.eligible || isRegisterConfirmationMode;
  const acceptedAtText = acceptance?.acceptedAt ? new Date(acceptance.acceptedAt).toLocaleString(locale || "et") : "";
  const documentTitle = frameworkDocument?.title || t("auth.register.worker_framework_title");
  const fullDocumentBlocks = [
    ...(frameworkDocument?.prefaceBlocks || []),
    ...(frameworkDocument?.documentBlocks || [])
  ];
  const documentHtml = frameworkDocument?.html || "";

  return (
    <section lang={locale} onWheel={handleShellWheel}>
      <div
        ref={panelRef}
        className={`${panelClassName} ${isClosing ? "pointer-events-none" : ""}`}
      >
        <SubpageHeader
          onBack={handleBack}
          backAriaLabel={t("buttons.back_previous")}
          holdPressedVisualDisabled
          anchorBack={false}
          titleId="worker-framework-title"
          backClassName="workspace-scroll-back-button"
        >
          {frameworkTitle}
        </SubpageHeader>
        <p className="legal-version-note">
          {t("legal.version_note", { version: WORKER_FRAMEWORK_VERSION })}
        </p>

        <div>
          <section aria-labelledby="framework-intro-title">
            <h2 id="framework-intro-title">
              {introCopy.introTitle}
            </h2>
            <p>{introCopy.lead}</p>
            {introCopy.paragraphs.map((paragraph, index) => (
              <p key={index}>
                {paragraph}
              </p>
            ))}
            <div>
              <Button
                as="a"
                href={frameworkDocxHref}
                target="_blank"
                rel="noopener noreferrer"
                variant="primary"
              >
                {t("auth.register.worker_framework_download_docx")}
              </Button>
              <Button
                as="a"
                href={WORKER_FRAMEWORK_SIGNED_HREF}
                download
                onClick={handleSignedDownload}
                variant="primary"
              >
                {t("auth.register.worker_framework_download_signed")}
              </Button>
            </div>
            <Panel variant="subpage" padding="sm">
              {frameworkStatus.loading ? (
                <p>{t("documents.loading")}</p>
              ) : null}
              {!frameworkStatus.loading && saveError ? (
                <p>{saveError}</p>
              ) : null}
              {!frameworkStatus.loading && frameworkStatus.eligible && isAccepted ? (
                <>
                  <p>
                    {t("documents.framework_acceptance.manage_confirmed", { date: acceptedAtText })}
                  </p>
                  <div>
                    {acceptance?.documentDownloadUrl ? (
                      <Button as="a" href={acceptance.documentDownloadUrl} variant="primary">
                        {t("documents.framework_acceptance.download_record")}
                      </Button>
                    ) : null}
                    <Button
                      as="a"
                      href={WORKER_FRAMEWORK_SIGNED_HREF}
                      download
                      onClick={handleSignedDownload}
                      variant="primary"
                    >
                      {t("auth.register.worker_framework_download_signed")}
                    </Button>
                  </div>
                </>
              ) : null}
              {!frameworkStatus.loading && !isAccepted ? (
                <>
                  <Checkbox
                    id="framework-page-ack"
                    name="frameworkAck"
                    checked={confirmChecked}
                    disabled={!canConfirmFramework || savePending}
                    onChange={(next) => setConfirmChecked(next)}
                    label={t("auth.register.worker_framework_ack")}
                  />
                  {canConfirmFramework ? (
                    <div>
                      <Button
                        type="button"
                        onClick={handleSaveAcceptance}
                        disabled={!confirmChecked || savePending}
                        variant="primary"
                      >
                        {savePending
                          ? t("documents.framework_acceptance.confirm_saving")
                          : t("documents.framework_acceptance.confirm_now")}
                      </Button>
                    </div>
                  ) : (
                    <p>
                      {frameworkStatus.authenticated
                        ? t("documents.framework_acceptance.worker_only")
                        : t("documents.framework_acceptance.auth_required")}
                    </p>
                  )}
                </>
              ) : null}
              {saveNotice ? <p>{saveNotice}</p> : null}
            </Panel>
          </section>

          <section aria-label={documentTitle}>
            {documentHtml ? (
              <div dangerouslySetInnerHTML={{ __html: documentHtml }} />
            ) : (
              <div>
                <FrameworkBlocks blocks={fullDocumentBlocks} />
              </div>
            )}
          </section>
        </div>
      </div>
    </section>
  );
}
