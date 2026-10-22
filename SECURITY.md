# Security policy

## Reporting a concern

Do not publish credentials, private repository data or actionable exploit details in a public issue. Use a private reporting feature only if it is actually enabled on the repository, or request a verified private contact from the maintainer without posting the sensitive details.

No dedicated security email, supported-version schedule, acknowledgement deadline or remediation deadline is established by the supplied repository evidence. This policy deliberately makes no unverified operational commitment.

Include the affected implementation path, commit, minimal reproduction, expected/observed behaviour and redacted evidence. If credentials have been exposed, revoke or rotate them rather than relying only on removing a file.

## Credential boundaries

Worker credentials belong in local .dev.vars or deployment secrets, not browser variables or public assets. The Java backend has separate environment configuration. Keep both sets out of commits, screenshots, logs and model prompts.

Build scripts inspect generated assets and attempt to remove development-variable files. Their presence is not a guarantee that every secret format or disclosure path is covered. Review the actual artefacts before publishing.

## AI and repository evidence

Repository metadata, README text, commit messages and selected source/configuration evidence may be transmitted to configured AI providers. Fallback can send evidence to more than one provider. Review the configured chain and applicable data handling before processing sensitive content.

Treat fetched content and model output as untrusted. Runtime schemas constrain response shape; they do not establish factual correctness, prompt-injection immunity or permission to act on generated advice.

## Persistence and public access

Honest-mode results are stored in D1. The 24-hour cache lookup is not automatic deletion. The Worker exposes result-by-ID and leaderboard routes; an unguessable ID is not an authentication policy. Do not assume stored results are private.

Review data minimisation, retention/deletion, API access controls, rate/cost abuse and output handling before broadening deployment. These are review priorities, not claims that this documentation implemented protections.

## Scope

Report application-side misuse of third-party APIs and dependencies when relevant. Do not assume rate-limit or cost-abuse concerns are harmless merely because an upstream service is involved. Test only systems you own or are authorised to assess.

This documentation refresh is not a security audit and does not change application behaviour.
