/** `package.json`'s version, fixed at build time by `vite.config.ts` (GDD v0.20 §9.9). */
declare const __APP_VERSION__: string;
/** The commit built (`CF_PAGES_COMMIT_SHA`, else git), or `''`; validated by `versionLabel`. */
declare const __APP_COMMIT__: string;
/** The feedback form's address (ADR-0027 decision 1), checked by `vite.config.ts`, or `''`. */
declare const __FEEDBACK_FORM__: string;
