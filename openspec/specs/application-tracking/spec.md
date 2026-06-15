# application-tracking Specification

## Purpose

Defines how applications are tracked across their lifecycle: a persisted status per application, a timestamped event history (status changes, relances, free-text notes), and a tracking view over all applications. This gives the user a single place to see where each application stands and what has happened to it.

## Requirements

### Requirement: Application status lifecycle

The system SHALL track a status for each application across the lifecycle: `à_traiter`, `générée`, `validée`, `envoyée`, `relancée`, `réponse`. The status SHALL be persisted with a last-updated timestamp and be updatable by the user from the detail page. An offer with no application is treated as `à_traiter`.

#### Scenario: Status advances through the flow

- **WHEN** the user generates, validates, then marks an application as sent
- **THEN** its status reflects each step (`générée` → `validée` → `envoyée`) with updated timestamps

#### Scenario: Status persists across restarts

- **WHEN** the application is restarted and an application is viewed
- **THEN** its previously set status is shown (read from SQLite)

#### Scenario: Invalid status rejected

- **WHEN** a status update is requested with a value outside the allowed lifecycle
- **THEN** it is rejected with a clear message and the stored status is unchanged

### Requirement: Event history and notes

The system SHALL record an event history per application — status changes, relances, and free-text notes — each with a timestamp.

#### Scenario: Record a relance

- **WHEN** the user logs a relance on an application
- **THEN** a timestamped relance event is added to its history and the status can be set to `relancée`

#### Scenario: Add a note

- **WHEN** the user adds a free-text note to an application
- **THEN** the note is stored with a timestamp and shown in the application's history

### Requirement: Tracking view over all applications

The system SHALL provide a tracking view (`/suivi`) listing all applications with their offer title, current status, and last update, with a way to open each one's detail page.

#### Scenario: See all applications and their status

- **WHEN** the user opens the tracking view
- **THEN** it lists every application with its offer title, current status, and last-updated date

#### Scenario: Open an application from the tracking view

- **WHEN** the user selects an application in the tracking view
- **THEN** its offer detail page opens

#### Scenario: Status shown in the offer list

- **WHEN** the offer list is shown
- **THEN** each offer displays its current application status
