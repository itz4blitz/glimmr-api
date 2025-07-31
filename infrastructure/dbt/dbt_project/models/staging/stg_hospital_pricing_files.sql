{{
  config(
    materialized='view',
    description='Staging model for hospital pricing transparency files'
  )
}}

-- Staging model for raw hospital pricing files
-- This model cleans and standardizes the raw data from Airbyte

with source_data as (
    select
        id,
        hospital_id,
        file_url,
        file_name,
        file_size,
        file_type,
        processing_status,
        extracted_at,
        processed_at,
        created_at,
        updated_at,
        metadata
    from {{ source('raw', 'price_transparency_files') }}
),

cleaned_data as (
    select
        id as file_id,
        hospital_id,
        file_url,
        file_name,
        file_size,
        upper(file_type) as file_type,
        lower(processing_status) as processing_status,
        extracted_at,
        processed_at,
        created_at,
        updated_at,
        
        -- Extract metadata fields
        case 
            when metadata is not null 
            then metadata::jsonb->>'version'
            else null 
        end as file_version,
        
        case 
            when metadata is not null 
            then (metadata::jsonb->>'record_count')::integer
            else null 
        end as record_count,
        
        -- Data quality flags
        case 
            when file_size > 0 then true 
            else false 
        end as has_valid_size,
        
        case 
            when processing_status = 'completed' then true 
            else false 
        end as is_processed,
        
        case 
            when extracted_at is not null then true 
            else false 
        end as is_extracted

    from source_data
)

select * from cleaned_data
