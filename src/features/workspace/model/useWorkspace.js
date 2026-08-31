import { useEffect, useRef, useState } from "react";
import {
  clone,
  createOnboardingWorkspace,
  effectiveCatalog,
  mergeCatalog,
  migrateWorkspace,
  sameWorkspaceContent,
  validateWorkspace,
} from "../../../entities/schedule/index.js";
import { readBrowser, writeBrowser } from "../lib/browserStorage.js";

import { requestWorkspace } from "./workspaceApi.js";
import { requestPublicSchedule } from "./scheduleCatalogApi.js";

export function useWorkspace(
  base,
  catalog,
  { testMode = false, diskPersistence = import.meta.env.DEV } = {},
) {
  const useDisk = diskPersistence && !testMode;
  const [initial] = useState(() => {
    let saved;
    try {
      saved = readBrowser(window.localStorage, base, catalog, { testMode });
    } catch {
      saved = { error: "Хранилище браузера недоступно." };
    }
    return {
      record: saved.record || {
        state: createOnboardingWorkspace(catalog),
        serverRevision: 0,
        pending: useDisk,
      },
      error: saved.error || "",
    };
  });
  const [state, setState] = useState(initial.record.state);
  const current = useRef(initial.record);
  const [ready, setReady] = useState(false),
    [status, setStatus] = useState("Проверяем сохранённую версию…");
  const [error, setError] = useState(initial.error),
    [diskConflict, setDiskConflict] = useState(false);
  const [catalogStatus, setCatalogStatus] = useState({
    state: initial.record.state.catalogSource?.status || "idle",
    message: initial.record.state.catalogSource?.message || "",
  });
  const busy = useRef(false),
    timer = useRef(null),
    mounted = useRef(true);
  const writeLocal = () => {
    let warning;
    try {
      warning = writeBrowser(window.localStorage, current.current, {
        testMode,
      });
    } catch {
      warning = "Не удалось сохранить в браузере.";
    }
    if (warning) setError(warning);
    return warning;
  };
  async function saveDisk() {
    if (busy.current || !current.current.pending) return;
    busy.current = true;
    const snapshot = current.current.state;
    setStatus("Сохраняем на диск…");
    try {
      const result = await requestWorkspace("PUT", {
        state: snapshot,
        revision: current.current.serverRevision,
      });
      if (!mounted.current) return;
      current.current = {
        ...current.current,
        serverRevision: result.revision,
        pending: current.current.state !== snapshot,
      };
      const warning = writeLocal();
      setDiskConflict(false);
      setError(warning || "");
      setStatus(
        warning
          ? "Сохранено в файле проекта"
          : "Сохранено в браузере и на диске",
      );
    } catch (e) {
      if (!mounted.current) return;
      setDiskConflict(!!e.conflict);
      setError(e.message);
      setStatus("Копия на диске не обновлена");
    } finally {
      busy.current = false;
      if (
        mounted.current &&
        current.current.state !== snapshot &&
        current.current.pending
      )
        timer.current = setTimeout(saveDisk, 700);
    }
  }
  useEffect(() => {
    mounted.current = true;
    let cancelled = false;
    if (!useDisk) {
      current.current = { ...current.current, pending: false };
      writeLocal();
      setStatus(
        testMode
          ? "Тестовый профиль · сохранено отдельно"
          : "Сохранено только в этом браузере",
      );
      setReady(true);
      return () => {
        mounted.current = false;
        clearTimeout(timer.current);
      };
    }
    (async () => {
      try {
        const remote = await requestWorkspace();
        if (remote.state)
          remote.state = migrateWorkspace(remote.state, base, catalog);
        if (cancelled) return;
        if (
          remote.state &&
          current.current.pending &&
          current.current.serverRevision !== remote.revision
        ) {
          if (sameWorkspaceContent(current.current.state, remote.state)) {
            current.current = {
              state: remote.state,
              serverRevision: remote.revision,
              pending: false,
            };
            setState(remote.state);
          } else if (
            initial.record.serverRevision === 0 &&
            !initial.record.state.updatedLocally
          ) {
            current.current = {
              state: remote.state,
              serverRevision: remote.revision,
              pending: false,
            };
            setState(remote.state);
          } else {
            setDiskConflict(true);
            setError(
              "В браузере и на диске разные версии. Скачай свою копию перед загрузкой версии с диска.",
            );
            setStatus("Нужно выбрать версию");
            setReady(true);
            return;
          }
        } else if (remote.state && !current.current.pending) {
          current.current = {
            state: remote.state,
            serverRevision: remote.revision,
            pending: false,
          };
          setState(remote.state);
        }
        const warning = writeLocal();
        setStatus("Сохранено в браузере и на диске");
        if (remote.recovered)
          setError("Файл проекта восстановлен из резервной копии.");
        else if (!warning) setError("");
      } catch (e) {
        if (cancelled) return;
        writeLocal();
        setError(e.message);
        setStatus("Работаем с копией браузера");
      }
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
      mounted.current = false;
      clearTimeout(timer.current);
    };
  }, []);
  useEffect(() => {
    if (useDisk && ready && !diskConflict && current.current.pending)
      timer.current = setTimeout(saveDisk, 600);
    return () => clearTimeout(timer.current);
  }, [state, ready, diskConflict]);
  // Save browser edits synchronously; serialize disk writes using optimistic revision checks.
  function update(recipe) {
    if (!ready) return;
    const next =
      typeof recipe === "function"
        ? recipe(clone(current.current.state))
        : recipe;
    const updated = {
      ...next,
      updatedAt: new Date().toISOString(),
      updatedLocally: true,
    };
    validateWorkspace(updated);
    current.current = {
      ...current.current,
      state: updated,
      pending: useDisk,
    };
    const warning = writeLocal();
    setState(updated);
    setStatus(
      warning
        ? "Сохранение браузера недоступно"
        : !useDisk
          ? testMode
            ? "Тестовый профиль · сохранено отдельно"
            : "Сохранено только в этом браузере"
          : "Сохранено в браузере · ожидает записи на диск",
    );
  }
  async function synchronize() {
    if (!useDisk) {
      setStatus("Публичная версия хранит данные только в этом браузере");
      return;
    }
    if (busy.current) {
      setStatus("Запись на диск уже выполняется…");
      return;
    }
    try {
      const remote = await requestWorkspace();
      if (remote.state)
        remote.state = migrateWorkspace(remote.state, base, catalog);
      if (
        current.current.pending &&
        remote.revision !== current.current.serverRevision
      ) {
        if (sameWorkspaceContent(current.current.state, remote.state)) {
          current.current = {
            state: remote.state,
            serverRevision: remote.revision,
            pending: false,
          };
          setState(remote.state);
          writeLocal();
          setDiskConflict(false);
          setError("");
          setStatus("Синхронизировано с файлом проекта");
          return;
        }
        setDiskConflict(true);
        throw new Error(
          "На диске другая версия. Скачай свою копию, затем загрузи версию с диска.",
        );
      }
      if (current.current.pending) await saveDisk();
      else if (remote.state) {
        current.current = {
          state: remote.state,
          serverRevision: remote.revision,
          pending: false,
        };
        setState(remote.state);
        writeLocal();
        setError("");
        setStatus("Синхронизировано с файлом проекта");
        setDiskConflict(false);
      }
    } catch (e) {
      setError(e.message);
    }
  }
  async function loadDisk() {
    if (!useDisk) {
      setStatus("Публичная версия хранит данные только в этом браузере");
      return;
    }
    if (busy.current) return;
    try {
      const remote = await requestWorkspace();
      if (remote.state)
        remote.state = migrateWorkspace(remote.state, base, catalog);
      if (!remote.state)
        throw new Error("На диске ещё нет сохранённого расписания.");
      current.current = {
        state: remote.state,
        serverRevision: remote.revision,
        pending: false,
      };
      setState(remote.state);
      writeLocal();
      setDiskConflict(false);
      setError("");
      setStatus("Открыта версия с диска");
    } catch (e) {
      setError(e.message);
    }
  }
  async function refreshCatalog() {
    const profile = current.current.state.profile;
    if (!profile || catalogStatus.state === "loading") return;
    setCatalogStatus({
      state: "loading",
      message: "Проверяем расписание ИТМО…",
    });
    try {
      const result = await requestPublicSchedule(profile);
      update((workspace) => ({
        ...workspace,
        catalogOverrides: result.catalog.entries.length
          ? mergeCatalog(
              workspace.catalogOverrides,
              result.catalog,
              workspace.publishedSnapshot.meta,
            )
          : workspace.catalogOverrides,
        catalogSource: {
          type: workspace.catalogSource?.type || "itmo-public",
          status: result.status,
          checkedAt: result.fetchedAt,
          sourceUrl: result.sourceUrl,
          message: result.message,
        },
      }));
      setCatalogStatus({ state: result.status, message: result.message });
      return result;
    } catch (catalogError) {
      setCatalogStatus({ state: "error", message: catalogError.message });
      return null;
    }
  }
  return {
    state,
    catalog: effectiveCatalog(
      catalog,
      state.catalogOverrides,
      state.publishedSnapshot?.meta || base.meta,
      state.catalogSource,
    ),
    update,
    ready,
    status,
    error,
    diskConflict,
    synchronize,
    loadDisk,
    refreshCatalog,
    catalogStatus,
    migrate: (value) => migrateWorkspace(value, base, catalog),
    testMode,
    storageMode: useDisk ? "disk" : "browser",
  };
}
