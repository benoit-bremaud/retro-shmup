# Class and sequence diagram — meta — the version label (v0.20)

> **Source specs**: [Game Design Document](../../../design/game-design-document.md) v0.20 §9.9
> **Related ADRs**: ADR-0025 decision 6 (version shown in the game), ADR-0003 (composition root),
> ADR-0008 (CSP: no inline style or script)
> **Realizes**: the "version label" of §9.9; no use case of its own (the player does nothing)

## Context

The version never enters the domain: the build resolves it into two constants, the composition
root formats them with one pure function and writes the result into a page element with
`textContent`. Nothing is read at run time, no port is needed.

## Diagram

```mermaid
classDiagram
  class ViteConfig {
    <<build, vite.config.ts>>
    +define __APP_VERSION__ : string
    +define __APP_COMMIT__ : string
  }
  class versionLabel {
    <<pure function, src/app/version-label.ts>>
    +versionLabel(version, commit) string
  }
  class Main {
    <<composition root>>
    +showVersion(element)
  }
  class VersionElement {
    <<index.html, p#version>>
    +textContent
  }
  ViteConfig ..> Main : injects constants
  Main ..> versionLabel : formats
  Main --> VersionElement : sets textContent
```

```mermaid
sequenceDiagram
  title sd — build and show the version
  participant Build as vite.config.ts
  participant Env as package.json / CF_PAGES_COMMIT_SHA / git
  participant Main as main.ts
  participant Fn as versionLabel
  participant El as p#version
  Build->>Env: read version, commit
  Env-->>Build: "0.1.0", "abc1234def..." or none
  Build->>Main: define __APP_VERSION__, __APP_COMMIT__
  Main->>Fn: versionLabel("0.1.0", "abc1234def...")
  Fn-->>Main: "v0.1.0+abc1234" (commit not 7+ hex → "v0.1.0")
  Main->>El: textContent = label
```

## Rules the code must satisfy

- The commit is accepted only if it matches `^[0-9a-f]{7,40}$` (cut to 7); anything else is
  dropped, never shown (the value comes from the environment).
- git is queried with `execFileSync` and an argument list, never a shell; a failure means "no
  commit".
- The element is styled from `style.css` (CSP `style-src 'self'`), ignores pointer events.
