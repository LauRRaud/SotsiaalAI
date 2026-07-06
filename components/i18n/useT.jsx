"use client";

import { useI18n } from "./I18nProvider";

function useT() {
  const {
    t
  } = useI18n();
  return t;
}

export default useT;
