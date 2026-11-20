// Frontend configuration utility
// Centralizes all API URLs and configuration

const config = {
  apiUrl: import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? "http://localhost:5000" : ""),
  registrationEnabled: import.meta.env.DEV,
  googleAuthEnabled: import.meta.env.VITE_GOOGLE_AUTH_ENABLED === "true",
} as const;

export default config;
