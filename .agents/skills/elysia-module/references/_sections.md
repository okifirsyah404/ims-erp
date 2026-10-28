# Sections — elysia-module skill

Rule categories, ordered by impact.

## 1. Persistence Boundaries — CRITICAL

What each module owns in the database. Violations here couple migrations,
block module extraction, and create hidden deletion semantics.

- 3.1 One Module = One Postgres Schema = One Schema File
- 3.2 No FKs Across Schemas
- 3.3 Identity Tables Belong to Auth; User & Organization Project

## 2. Cross-Module Access — HIGH

How modules may reference and talk to each other.

- 3.4 Cross-Module Imports: Schema Types and DI Tokens Only
- 3.5 Cross-Module Communication Is Service to Service

## 3. Lifecycle — MEDIUM

Creating a module without entangling others.

- 3.6 New Module Checklist
