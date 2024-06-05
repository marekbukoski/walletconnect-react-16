// import { cryptoStrings as strings } from "res/strings";
// import { useStore } from "../../store";
import { isDevEnv, logFetcher } from "./logFetcher";

export const LogLevel = {
  FATAL: "fatal",
  ERROR: "error",
  WARN: "warn",
  INFO: "info",
  DEBUG: "debug",
}

/**
 *
 * @param message message can be string or object that will be serialized
 * @param level
 * @param meta
 * @returns
 */
export async function sendLogDna(message, level) {
  if (!message) return;
  if (
    !isDevEnv &&
    ![LogLevel.FATAL, LogLevel.ERROR, LogLevel.INFO].includes(level)
  )
    return;

  const serializedMessage =
    typeof message === "string" ? message : JSON.stringify(message);
  const metaData = {
    userAgent: window.navigator.userAgent,
    userInfo: {},
    // userInfo: useStore.getState().userInfo,
    client: "crypto-ingress-iframe",
    lang: "en",
  };

  return logFetcher.post(
    `/logs/ingest?hostname=${window.location.hostname}`,
    {
      lines: [
        {
          line: serializedMessage,
          app: "crypto-ingress-iframe",
          level,
          meta: metaData,
        },
      ],
    },
  );
}

function error(...message) {
  isDevEnv && console.error(...message);
  sendLogDna(message, LogLevel.ERROR);
}

function fatal(...message) {
  isDevEnv && console.error(...message);
  sendLogDna(message, LogLevel.FATAL);
}

function warn(...message) {
  isDevEnv && console.warn(...message);
  sendLogDna(message, LogLevel.WARN);
}

function info(...message) {
  isDevEnv && console.info(...message);
  sendLogDna(message, LogLevel.INFO);
}

function debug(...message) {
  isDevEnv && console.debug(...message);
  sendLogDna(message, LogLevel.DEBUG);
}

/**
 * * message can be string or object that can be serialized
 */
export const logger = { error, fatal, warn, info, debug };
