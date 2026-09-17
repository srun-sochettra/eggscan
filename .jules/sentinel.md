## 2024-10-14 - Prevent Information Leakage in Controller Error Responses
**Vulnerability:** The backend `ScanController` returned the raw exception message (`e.getMessage()`) directly to clients in the JSON response upon an error. This poses an information leakage risk because stack traces or internal implementation details could be inadvertently exposed to end-users.
**Learning:** Found instances where error handling in controllers caught generic `Exception e` and passed the message to the user response. The fix replaces the raw exception message with a generic, safe client-facing message ("An error occurred while processing the request").
**Prevention:** Always log exceptions securely on the server side (using SLF4J, e.g., `log.error()`) to retain debugging context, but return generic error messages to the client API response. Avoid passing unfiltered exception messages directly in API responses.
## 2024-06-11 - [CRITICAL] Fix Hardcoded Database Secrets in Application Config
**Vulnerability:** Hardcoded PostgreSQL database URL, username, and password in `backend/src/main/resources/application.yml`.
**Learning:** Hardcoded credentials in source control can expose the database to unauthorized access, potentially leading to data breaches or loss.
**Prevention:** Always use environment variables for sensitive configuration values like database credentials, API keys, and tokens. In Spring Boot, this is achieved using `${ENV_VAR_NAME}` syntax in `application.yml`.
## 2024-10-18 - Input Validation and Sanitization in ScanController and Frontend Forms
**Vulnerability:** The application was not strictly validating user inputs (GitHub usernames, repository names, and UUIDs) on the backend `ScanController`, nor sanitizing them or limiting their length on the frontend forms (`ScanForm`, `BattleForm`).
**Learning:** Found instances where arbitrary or malformed strings could be passed to backend API endpoints and GitHub/Groq services. The fix adds rigorous input validation in `ScanController.java` using exact regular expressions for allowed characters, rejecting invalid data with 400 Bad Request before processing. Additionally, the frontend input fields now restrict character length (`maxLength=39`) and strip invalid characters.
**Prevention:** Always implement strict input validation on the server side using patterns or explicit checks, and enforce input constraints (length, characters) on the frontend. Fail fast on the backend with appropriate client error responses to prevent injection risks or unhandled application errors.
## 2026-06-17 - Prevent Use of Guessable Default Database Passwords
**Vulnerability:** The application was configured with a guessable default fallback password in the PostgreSQL database configuration (backend/src/main/resources/application.yml).
**Learning:** Using predictable default values for database passwords in configuration files can expose the system to unauthorized access if environment variables are not correctly set.
**Prevention:** Ensure that sensitive configuration properties either lack default values or fallback to empty strings so that missing environment variables cause connection failures rather than allowing insecure connections.

## 2024-06-19 - Added timeout to WebClient configurations
**Learning:** WebClient instances without explicit timeouts can cause resource exhaustion (e.g., thread pool starvation) and application unresponsiveness if external services (like the GitHub API) hang or respond too slowly. This is a common denial-of-service (DoS) vector.
**Action:** Always configure `responseTimeout` on the underlying `HttpClient` when building `WebClient` instances to ensure requests fail fast and resources are released promptly.

## 2024-06-22 - Resilience with Exponential Backoff
**Learning:** Hard-failing immediately upon encountering an external API error (like a 502 Bad Gateway from GitHub or Groq) makes the application brittle to transient network conditions. However, blanket retries on all HTTP errors are dangerous (e.g., retrying a 401 Unauthorized or a 404 Not Found is useless and wastes resources/rate limits).
**Action:** When configuring reactive `WebClient` instances for external APIs, always implement an intelligent retry mechanism. Use `ExchangeFilterFunction` combined with `Retry.backoff()` to apply exponential backoff, and strictly use `.filter()` to only trigger retries on transient errors like `5xx Server Error`.