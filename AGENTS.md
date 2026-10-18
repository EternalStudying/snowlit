# Project Agent Rules

## Project Context

1. At the start of every new project thread, read the root AGENTS.md file first.
2. At the start of every new project thread, use the planning-with-files skill to read the root task_plan.md.
3. Web threads must also read frontend/task_plan.md, frontend/findings.md, and frontend/progress.md. Backend threads must read the corresponding three files under backend. Full-stack threads must read both sets.
4. Mini-program threads must read miniprogram/product-spec.md and miniprogram/technical-spec.md. Also read backend context when the task involves APIs, databases, authorization, or production domains; read frontend context when Web coordination is involved.
5. After completing a requirement, decide which root or area-specific context needs updating based on complexity, maintenance value, and continuity. Keep the Web/backend planning files maintained during version-two development; do not restore long version-one task journals.

## Command-Line Tools

1. When using rg/ripgrep, invoke /Applications/Codex.app/Contents/Resources/rg explicitly. Do not use a system or PATH-provided rg.

## Project-Manager Agent

1. When a user brings a requirement to the project-manager agent, ask all necessary questions until the intent, goal, boundaries, acceptance criteria, and execution constraints are fully understood before producing the implementation prompt.
2. Confirm full understanding through questions before writing specifications or prompts; do not proceed while material ambiguity or competing interpretations remain.
3. Prompts may target a Web, backend, or other single-responsibility execution agent. Requirements spanning Web and backend must explicitly target a full-stack agent.
4. Write a specification before the prompt, except for very simple, one-off, low-risk requirements with clear boundaries. If unsure whether a specification is needed, ask the user.
5. These rules apply only to conversations with the project-manager agent, not to Web, backend, full-stack, or other execution agents.
6. The project-manager agent must not edit code by default. Code edits require explicit user permission or an explicit implementation request.

## Mini-Program Agent

1. Prefer the engineering-wechat-mini-program-developer agent for mini-program tasks. Do not apply Web implementation assumptions directly to native mini-program work.
2. Mini-program code belongs in miniprogram/, alongside frontend/ and backend/, never inside frontend/.
3. miniprogram/product-spec.md is the long-term product entry point; miniprogram/technical-spec.md is the long-term technical entry point. Update the former for product-scope changes and the latter for APIs, architecture, platform capabilities, review, or privacy changes.
4. Version one uses native WeChat capabilities and the existing Spring Boot backend. Do not introduce cloud development, a second business dataset, or replicas of Web GSAP/Lenis/Three immersive animation by default.
5. Never store openid, session_key, or AppSecret on the mini-program client. Store backend-issued business tokens only. Authorization must be enforced by the backend, not trusted from client-supplied state.
6. For new modules, follow the technical specification's directory and layering rules: add services/<domain>.js for API access first; pages own state, interaction, and presentation. Uploads use shared wrappers; pages do not construct business API URLs directly.
7. When adding location, image upload, subscription messages, image saving, or other platform capabilities, also confirm privacy disclosures, legal domains, categories/permissions, and fallbacks.

## Dependencies

1. Dependencies may be added when they make the requested implementation easier.
2. Explain the problem each added dependency solves and avoid dependencies unrelated to the requirement.

## Web Screenshot and UI Checks

1. Use Chrome MCP and Playwright for their complementary roles in screenshots, live visual checks, and UI-flow debugging.
2. Prefer Chrome MCP (mcp__chrome_devtools) for quick navigation, interaction, screenshots, console/network inspection, and individual UI states.
3. Prefer Playwright for repeatable automation, multiple viewports, traces, complex regression flows, or retained script evidence. Use existing project/local Playwright and browser capabilities.
4. Put temporary browser scripts, screenshots, traces, and reports under the project-root codex-work/ directory.
5. Do not temporarily install @playwright/cli. Use the existing project/local Playwright capability when needed.

## Web UI References

1. Page and component design may reference code, interaction, and visual ideas from:
   - Animate UI: https://animate-ui.com/
   - Kokonut UI Card Flip: https://kokonutui.com/docs/cards/card-flip
   - React Bits: https://reactbits.dev/
   - Design Spells: https://www.designspells.com/
2. Adapt references to the existing stack, visual language, and interaction rules; do not accumulate unrelated effects.
3. Before reusing component code, check dependencies, licensing, and implementation cost. Convert React examples to the project's Vue 3 + Vite implementation.
