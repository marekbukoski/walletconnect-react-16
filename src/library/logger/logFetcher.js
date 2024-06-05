import axios from "axios";

export const isDevEnv = process.env.NODE_ENV === "development";

export const logFetcher = axios.create({
  baseURL: "https://logs.logdna.com",
  headers: {
    "Content-Type": "application/json; charset=UTF-8",
    apiKey: process.env.REACT_APP_NEXT_PUBLIC_LOGDNA_APIKEY,
  },
});
