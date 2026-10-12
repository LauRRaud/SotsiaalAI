"use client";

import { useId, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";

import { useScreenFocus } from "../client/useScreenFocus";
import { useSendOnce } from "../client/useSendOnce";
import { formatDateTime } from "../homeCareClient";
import { addReady, candidateOptions, memberChip, memberName, openerRows, statusRows, teamPage, teamRights, teamRows } from "./teamRows";
import { AddView, ListView, MemberView, TeamView } from "./TeamViews";
import { useClientTeam } from "./useClientTeam";

/**
 * Kliendi lehe osa „Meeskond": konks hoiab töötajate valikut ja päringuid, siin
 * pannakse vaated kokku. Ees on üks vaade korraga: meeskond, üks liige, „Lisa
 * töötaja", „Viimati avasid" või „Seisu ajalugu".
 *
 * Osa on lehel kogu aja (pooleli valik ei kao vaate vahetusel) ja joonistatakse
 * siis, kui ta on ees (`active`). Liikme eemaldamine võtab ta nimekirjast:
 * see küsib teist vajutust.
 *
 * `team`, `openers`, `history`: kliendi lehe andmed (meeskond hoitakse lehel: sama seisu kasutavad ka
 * kirje sammud ja osade laua plaat); `who`: { canWrite, isCoordinator }; `onChange(team)`: leht võtab uue seisu.
 */
export default function ClientTeam({ active, organizationId, clientId, title, name, team, openers, history, who, timeZone, onChange }) {
  const { t } = useI18n();
  const formId = useId();
  const state = useClientTeam({ organizationId, clientId, onChange });
  /* "" (meeskond), "member:<id>", "add", "openers" või "history". */
  const [screen, setScreen] = useState("");
  /* Eemaldamise esimene vajutus on tehtud. */
  const [armed, setArmed] = useState(false);
  /* Loendid, kus „Näita veel" on vajutatud. */
  const [expanded, setExpanded] = useState({});
  const rootRef = useScreenFocus(screen);
  /* Teine vajutus päringu ajal ei saada teist päringut. */
  const once = useSendOnce();

  if (!active) return null;

  const go = (next) => {
    setArmed(false);
    state.setError("");
    setScreen(next);
  };
  const fault = state.error ? { text: state.error, tone: "risk" } : null;
  const wrap = (view) => <div ref={rootRef}>{view}</div>;
  const rights = teamRights(who);
  const moment = (value) => formatDateTime(value, timeZone);
  const back = { label: t("home_care.parts.back"), onBack: () => go("") };
  const moreFor = (key, rows) => {
    const page = teamPage(rows, Boolean(expanded[key]));
    return { rows: page.rows, more: page.more ? { label: t("home_care.home.more"), onMore: () => setExpanded((now) => ({ ...now, [key]: true })) } : null };
  };

  if (screen === "add" && rights.edit) {
    const options = candidateOptions(state.candidates, team);
    return wrap(
      <AddView
        title={t("home_care.team.add_label")}
        form={{
          id: `${formId}-add`,
          onSubmit: async (event) => {
            event.preventDefault();
            if (addReady(options, state.selected) && (await once(state.add))) go("");
          }
        }}
        pick={{ label: t("home_care.team.pick_label"), options, value: state.selected, onChange: state.setSelected }}
        none={t("home_care.team.add_none")}
        save={{ label: t("home_care.team.add"), busy: state.busy, disabled: !addReady(options, state.selected) }}
        notice={fault}
        back={back}
      />
    );
  }

  if (screen === "openers" || screen === "history") {
    const opened = screen === "openers";
    const page = moreFor(screen, opened ? openerRows(openers, { t, moment }) : statusRows(history, { t, moment }));
    return wrap(<ListView title={t(opened ? "home_care.client.opened_recently" : "home_care.client.status_history")} rows={page.rows} more={page.more} back={back} />);
  }

  const [kind, id] = screen.split(":");
  const member = kind === "member" ? team.find((item) => item.membershipId === id) : null;
  if (member && rights.edit) {
    return wrap(
      <MemberView
        title={title}
        sheet={{ name: memberName(member), chip: memberChip(member, { t }) }}
        actions={[
          {
            key: "remove",
            label: t("home_care.team.remove"),
            armed,
            /* Eemaldamine küsib teist vajutust samal lahtril. */
            onPress: async () => {
              if (!armed) {
                setArmed(true);
                return;
              }
              setArmed(false);
              if (await once(() => state.remove(member.membershipId))) setScreen("");
            }
          }
        ]}
        consequence={armed ? t("home_care.team.remove_note") : ""}
        busy={state.busy}
        notice={fault}
        back={back}
      />
    );
  }

  const page = moreFor("", teamRows(team, who, { t }).map((row) => ({ ...row, open: rights.edit })));
  const lists = [
    (openers || []).length ? { key: "openers", title: t("home_care.client.opened_recently"), line: t("home_care.team.list_count", { count: openers.length }), onOpen: () => go("openers") } : null,
    (history || []).length ? { key: "history", title: t("home_care.client.status_history"), line: t("home_care.team.list_count", { count: history.length }), onOpen: () => go("history") } : null
  ].filter(Boolean);
  return wrap(
    <TeamView
      title={title}
      name={name}
      rows={page.rows}
      onOpen={(key) => go(`member:${key}`)}
      empty={t("home_care.team.empty")}
      lists={lists}
      hint={who.isCoordinator ? t("home_care.team.hint") : ""}
      busy={state.busy}
      notice={fault}
      more={page.more}
      add={
        rights.edit
          ? {
              label: t("home_care.team.add_label"),
              busy: state.busy,
              /* Töötajate valik laaditakse alles siin; vaade avatakse, kui see õnnestus (tõrge jääb meeskonna vaate alla). */
              onAdd: async () => {
                if (state.candidates === null && !(await once(state.loadCandidates))) return;
                go("add");
              }
            }
          : null
      }
    />
  );
}
