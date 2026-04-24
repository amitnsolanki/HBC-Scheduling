# System Instructions & Persistent Rules

Hello to any future AI agent assisting on this project! The user has defined a strict global rule that MUST be adhered to upon ANY modifications to this codebase.

## Version Number Auto-Increment Rule
1. In the root `src/` directory, there is a file named `version.json`.
2. This project currently displays a polished floating "Ver 1.XX" badge at the bottom right of the UI.
3. Every single time the user asks you to make ANY change to the application logic, UI, backend, or components, you **MUST** increase the value of `"version"` in `/src/version.json` by exactly `0.01`.
4. Make sure to perform this increment at the very beginning or very end of your tool executions, and state the new version in your response to the user.

Example output: "I have implemented the feature. Version incremented to 1.62"
