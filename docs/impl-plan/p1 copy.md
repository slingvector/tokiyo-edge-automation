# Goal Description

The goal is to update the master `project-plan.md` document to incorporate critical architectural and operational details from the provided research document that were missing from the current draft. 

Based on my gap analysis, the `project-plan.md` successfully captured the 4 "Blind Spots", the Error Taxonomy, and the ML Kit OCR fallback strategy, but it missed the following crucial elements from your research:

1.  **Detailed Execution Activity Diagram:** The step-by-step state machine logic for the Edge Agent handling jobs.
2.  **Core Use Cases (UC-01 & UC-02):** The authenticated "Like" and "Comment" sequences.
3.  **Test Cases Matrix:** The exhaustive test scenarios (e.g., `TC-SEC-01`, `TC-IPC-01`, `TC-UI-03`).
4.  **Local Containerization Strategy:** Explicit instructions to use `docker-compose.yml` for the local backend orchestrator.
5.  **Centralized Log Ingestion & Dashboarding:** The integration of Loki/Elasticsearch and a Grafana Node Health Dashboard.
6.  **Automated Incident Routing:** The n8n webhook integration for Slack/Telegram alerting when a node circuit breaker trips.

## User Review Required

> [!IMPORTANT]  
> I will be directly modifying `/Users/cortex/ventures/tokiyo-edge-automation/docs/project-plan.md` to append the Diagrams, Use Cases, Test Matrix, and enhance the Backend/Telemetry epics with the Docker/Grafana/n8n requirements. Please review the proposed changes below.

## Open Questions

None at this time.

## Proposed Changes

### `project-plan.md`

#### [MODIFY] [project-plan.md](file:///Users/cortex/ventures/tokiyo-edge-automation/docs/project-plan.md)

1.  **Append Section 1.2: Execution Activity Diagram**
    *   Add the detailed ASCII flowchart tracing the decision logic, retry loops, and security gates from the research document.
2.  **Append Section 2.4: Core Use Cases**
    *   Add `UC-01: Authenticated Like Action` and `UC-02: Authenticated Comment Action`.
3.  **Update Epic 6 (Backend Orchestrator)**
    *   Add a specific task for **Local Containerization** (`docker-compose.yml` for Go/Node.js, Postgres, Redis).
    *   Enhance the Circuit Breaker task to include **Automated Incident Routing** via `n8n` webhooks for instant notifications.
4.  **Update Epic 7 (Telemetry & Observability)**
    *   Add tasks for **Centralized Log Ingestion** (Loki/Elasticsearch container) and a **Node Health Dashboard** (Grafana) to process the GZIP XML dumps.
5.  **Append Section 4.1: Test Cases Matrix**
    *   Insert the detailed matrix covering Security (Tampering, Replay), IPC (Daemon disconnect), UI (Coordinate math, Unicode injection), and OS Power (Deep Doze wakeups).

## Verification Plan

### Manual Verification
*   Review the updated `project-plan.md` to ensure all structural changes align with the markdown formatting and successfully capture the self-hosted observability stack (Grafana/n8n) and activity diagrams.
