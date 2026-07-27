# DATABASE.md

# HireFlow AI -- Database Design

## Doel

Een schaalbare multi-tenant database voor een AI-first
recruitmentplatform.

## Kernprincipes

-   Multi-tenant (`organization_id`)
-   Row Level Security op alle zakelijke tabellen
-   UUID primaire sleutels
-   `created_at` en `updated_at` waar relevant

## Tabellen

### organizations

-   id
-   name
-   created_at

### profiles

-   id
-   organization_id
-   full_name
-   email
-   role
-   created_at

### companies

-   id
-   organization_id
-   owner_id
-   name
-   website
-   sector
-   city
-   employee_count
-   priority
-   status
-   notes
-   created_at
-   updated_at

### contacts

-   id
-   company_id
-   organization_id
-   first_name
-   last_name
-   job_title
-   email
-   phone
-   linkedin_url
-   notes

### vacancies

-   id
-   company_id
-   organization_id
-   title
-   description
-   location
-   employment_type
-   salary_min
-   salary_max
-   status
-   requirements

### candidates

-   id
-   organization_id
-   first_name
-   last_name
-   email
-   phone
-   location
-   availability
-   salary_expectation
-   summary
-   skills
-   cv_path
-   status

### tasks

-   id
-   organization_id
-   owner_id
-   title
-   description
-   due_at
-   priority
-   status
-   related_entity_type
-   related_entity_id

### pipeline_items

-   id
-   organization_id
-   company_id
-   vacancy_id
-   candidate_id
-   stage
-   next_action_at

### ai_conversations

-   id
-   organization_id
-   user_id
-   title

### ai_messages

-   id
-   conversation_id
-   role
-   content
-   tool_name
-   created_at

### ai_tool_logs

-   id
-   organization_id
-   user_id
-   tool_name
-   arguments
-   result
-   status
-   created_at
