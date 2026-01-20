# JSON IntelliSense Feature - User Acceptance Testing Matrix

## Feature Overview

The JSON IntelliSense feature provides context-aware autocomplete, validation,
and documentation for F5 XC resource editing in VSCode.

## Test Environment Setup

### Prerequisites

1. VSCode version 1.107.0 or later
2. F5 XC Tools extension installed
3. Active F5 XC profile configured
4. Access to at least one namespace with resources

### Test Data Requirements

- At least one http_loadbalancer resource
- At least one origin_pool resource
- At least one healthcheck resource
- Test namespace with write permissions

---

## UAT Test Cases

### TC-001: Schema Provider Registration

| ID                  | TC-001                                                                                         |
| ------------------- | ---------------------------------------------------------------------------------------------- |
| **Title**           | Schema provider is registered on extension activation                                          |
| **Priority**        | High                                                                                           |
| **Preconditions**   | Extension installed but not activated                                                          |
| **Steps**           | 1. Open VSCode<br>2. Open the F5 XC explorer view<br>3. Check Output panel for "F5 XC" channel |
| **Expected Result** | Extension activates without errors, schema provider registered                                 |
| **Pass Criteria**   | No errors in output, extension functional                                                      |

---

### TC-002: IntelliSense for http_loadbalancer Files

| ID                  | TC-002                                                                                                                                            |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Title**           | IntelliSense works for \*.http_loadbalancer.json files                                                                                            |
| **Priority**        | High                                                                                                                                              |
| **Preconditions**   | Extension activated                                                                                                                               |
| **Steps**           | 1. Create new file: `test.http_loadbalancer.json`<br>2. Type `{` and press Enter<br>3. Press Ctrl+Space to trigger autocomplete<br>4. Type `"met` |
| **Expected Result** | Autocomplete shows `metadata` and `spec` as top suggestions                                                                                       |
| **Pass Criteria**   | `metadata` appears in autocomplete list                                                                                                           |

---

### TC-003: IntelliSense for Virtual Documents (f5xc://)

| ID                  | TC-003                                                                                                                                                                       |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Title**           | IntelliSense works when editing resources via f5xc://                                                                                                                        |
| **Priority**        | Critical                                                                                                                                                                     |
| **Preconditions**   | Active profile, existing http_loadbalancer resource                                                                                                                          |
| **Steps**           | 1. Expand namespace in F5 XC Explorer<br>2. Right-click http_loadbalancer → Edit Resource<br>3. In opened document, position cursor inside `spec: {}`<br>4. Press Ctrl+Space |
| **Expected Result** | Autocomplete shows valid spec properties for http_loadbalancer                                                                                                               |
| **Pass Criteria**   | Context-aware suggestions appear                                                                                                                                             |

---

### TC-004: Required Field Highlighting

| ID                  | TC-004                                                                                                                                                                             |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Title**           | Required fields are marked in autocomplete                                                                                                                                         |
| **Priority**        | Medium                                                                                                                                                                             |
| **Preconditions**   | Extension activated                                                                                                                                                                |
| **Steps**           | 1. Create `test.healthcheck.json`<br>2. Add `{ "metadata": {}, "spec": {} }`<br>3. Position cursor inside `metadata: {}`<br>4. Press Ctrl+Space<br>5. Hover over `name` suggestion |
| **Expected Result** | `name` marked as required (x-f5xc-required) in description                                                                                                                         |
| **Pass Criteria**   | Description indicates field is required                                                                                                                                            |

---

### TC-005: Validation Errors for Invalid JSON

| ID                  | TC-005                                                                                                                           |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **Title**           | Red squiggles appear for invalid property names                                                                                  |
| **Priority**        | High                                                                                                                             |
| **Preconditions**   | Extension activated                                                                                                              |
| **Steps**           | 1. Create `test.http_loadbalancer.json`<br>2. Add invalid JSON: `{ "invalid_top_level": true }`<br>3. Observe editor decorations |
| **Expected Result** | No validation errors (additionalProperties is true for flexibility)                                                              |
| **Pass Criteria**   | Schema validates structure, allows additional properties                                                                         |

---

### TC-006: Hover Documentation

| ID                  | TC-006                                                                                                         |
| ------------------- | -------------------------------------------------------------------------------------------------------------- |
| **Title**           | Hover shows field descriptions                                                                                 |
| **Priority**        | Medium                                                                                                         |
| **Preconditions**   | Extension activated, file with valid schema                                                                    |
| **Steps**           | 1. Create `test.healthcheck.json`<br>2. Add `{ "metadata": { "name": "test" } }`<br>3. Hover over `"name"` key |
| **Expected Result** | Hover tooltip shows description from schema                                                                    |
| **Pass Criteria**   | Description appears on hover                                                                                   |

---

### TC-007: Generic Schema Fallback

| ID                  | TC-007                                                                                               |
| ------------------- | ---------------------------------------------------------------------------------------------------- |
| **Title**           | Generic schema used for \*.f5xc.json files                                                           |
| **Priority**        | Medium                                                                                               |
| **Preconditions**   | Extension activated                                                                                  |
| **Steps**           | 1. Create `test.f5xc.json`<br>2. Type `{` and trigger autocomplete<br>3. Check available suggestions |
| **Expected Result** | Generic F5 XC schema provides basic metadata/spec structure                                          |
| **Pass Criteria**   | `metadata` and `spec` appear as suggestions                                                          |

---

### TC-008: Schema Cache Performance

| ID                  | TC-008                                                                                                                                       |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| **Title**           | Schema caching improves subsequent access                                                                                                    |
| **Priority**        | Low                                                                                                                                          |
| **Preconditions**   | Extension activated                                                                                                                          |
| **Steps**           | 1. Open `test.http_loadbalancer.json`<br>2. Trigger autocomplete (first access)<br>3. Close and reopen file<br>4. Trigger autocomplete again |
| **Expected Result** | Second access is noticeably faster (cached)                                                                                                  |
| **Pass Criteria**   | No delay on repeated access                                                                                                                  |

---

### TC-009: Multiple Resource Types Simultaneously

| ID                  | TC-009                                                                                                                                                                   |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Title**           | Different schemas for different file types                                                                                                                               |
| **Priority**        | High                                                                                                                                                                     |
| **Preconditions**   | Extension activated                                                                                                                                                      |
| **Steps**           | 1. Open `lb.http_loadbalancer.json` in tab 1<br>2. Open `pool.origin_pool.json` in tab 2<br>3. Open `hc.healthcheck.json` in tab 3<br>4. Verify autocomplete in each tab |
| **Expected Result** | Each file gets correct resource-specific schema                                                                                                                          |
| **Pass Criteria**   | Autocomplete shows different properties per resource type                                                                                                                |

---

### TC-010: Recommended Value Defaults

| ID                  | TC-010                                                                                                                             |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **Title**           | Recommended values appear as defaults in autocomplete                                                                              |
| **Priority**        | Medium                                                                                                                             |
| **Preconditions**   | Extension activated                                                                                                                |
| **Steps**           | 1. Create `test.healthcheck.json`<br>2. Inside spec, trigger autocomplete for `interval`<br>3. Check if default value is suggested |
| **Expected Result** | Default/recommended value (15) shown in completion details                                                                         |
| **Pass Criteria**   | Recommended value visible in autocomplete                                                                                          |

---

### TC-011: Server Default Field Hints

| ID                  | TC-011                                                                                                                                                |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Title**           | Server-defaulted fields marked in schema                                                                                                              |
| **Priority**        | Low                                                                                                                                                   |
| **Preconditions**   | Extension activated                                                                                                                                   |
| **Steps**           | 1. Create `test.origin_pool.json`<br>2. Add basic structure with spec<br>3. Trigger autocomplete for `loadbalancer_algorithm`<br>4. Check description |
| **Expected Result** | Field description mentions server provides default value                                                                                              |
| **Pass Criteria**   | x-f5xc-server-default noted in description                                                                                                            |

---

### TC-012: Extension Deactivation Cleanup

| ID                  | TC-012                                                                                                                          |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **Title**           | Schema provider cleanup on extension deactivation                                                                               |
| **Priority**        | Low                                                                                                                             |
| **Preconditions**   | Extension activated with cached schemas                                                                                         |
| **Steps**           | 1. Open several resource JSON files<br>2. Disable the F5 XC extension<br>3. Re-enable the extension<br>4. Open same files again |
| **Expected Result** | Extension cleanly deactivates and reactivates                                                                                   |
| **Pass Criteria**   | No memory leaks, schemas regenerated                                                                                            |

---

## Regression Test Suite

### RT-001: Existing Edit Functionality

| ID           | RT-001                                                                     |
| ------------ | -------------------------------------------------------------------------- |
| **Title**    | Edit resource command still works                                          |
| **Scope**    | Regression                                                                 |
| **Steps**    | 1. Right-click resource → Edit<br>2. Modify spec value<br>3. Save (Ctrl+S) |
| **Expected** | Resource saved to F5 XC API                                                |

### RT-002: Create Resource Functionality

| ID           | RT-002                                                                                   |
| ------------ | ---------------------------------------------------------------------------------------- |
| **Title**    | Create resource command still works                                                      |
| **Scope**    | Regression                                                                               |
| **Steps**    | 1. Right-click resource type → Create<br>2. Enter name and configure<br>3. Apply changes |
| **Expected** | New resource created                                                                     |

### RT-003: View Resource Functionality

| ID           | RT-003                                                    |
| ------------ | --------------------------------------------------------- |
| **Title**    | View resource shows JSON correctly                        |
| **Scope**    | Regression                                                |
| **Steps**    | 1. Right-click resource → View<br>2. Check JSON structure |
| **Expected** | Clean JSON without IntelliSense issues                    |

### RT-004: File System Provider

| ID           | RT-004                                          |
| ------------ | ----------------------------------------------- |
| **Title**    | f5xc:// URIs still resolve correctly            |
| **Scope**    | Regression                                      |
| **Steps**    | 1. Edit a resource<br>2. Check URI in tab title |
| **Expected** | URI format: f5xc://profile/ns/type/name.json    |

### RT-005: Profile Switching

| ID           | RT-005                                                                                       |
| ------------ | -------------------------------------------------------------------------------------------- |
| **Title**    | Schema works across profile switches                                                         |
| **Scope**    | Regression                                                                                   |
| **Steps**    | 1. Edit resource with profile A<br>2. Switch to profile B<br>3. Edit resource with profile B |
| **Expected** | IntelliSense works for both profiles                                                         |

---

## Test Coverage Matrix

| Component                   | Unit Tests | Integration Tests | UAT            |
| --------------------------- | ---------- | ----------------- | -------------- |
| schemaGenerator.ts          | PASS       | N/A               | TC-002, TC-007 |
| schemaRegistry.ts           | PASS       | N/A               | TC-008         |
| f5xcSchemaProvider.ts       | PASS       | N/A               | TC-001, TC-003 |
| extension.ts changes        | PASS       | PASS              | TC-001, RT-\*  |
| package.json jsonValidation | N/A        | PASS              | TC-002         |

---

## Sign-off Checklist

| Criteria                                 | Status | Tester | Date |
| ---------------------------------------- | ------ | ------ | ---- |
| All unit tests pass                      | ☐      |        |      |
| TC-001 through TC-012 pass               | ☐      |        |      |
| RT-001 through RT-005 pass               | ☐      |        |      |
| No console errors during testing         | ☐      |        |      |
| Performance acceptable (<1s schema load) | ☐      |        |      |
| Extension packaging successful           | ☐      |        |      |

---

## Notes

- IntelliSense relies on VSCode's built-in JSON language service
- Schema validation is relaxed (additionalProperties: true) to allow flexibility
- Custom extensions (x-f5xc-\*) provide hints but don't enforce validation
- Cache is pre-warmed for common resource types on activation
