import "server-only";

const configuredApiUrl = process.env.API_URL ?? "http://localhost:3004";

export const API_SERVER_URL = configuredApiUrl.replace(/\/+$/, "");
