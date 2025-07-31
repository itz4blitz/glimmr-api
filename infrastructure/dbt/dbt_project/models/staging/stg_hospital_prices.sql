{{
  config(
    materialized='view',
    description='Staging model for hospital pricing data'
  )
}}

-- Staging model for raw hospital pricing data
-- This model cleans and standardizes pricing information

with source_data as (
    select
        id,
        hospital_id,
        file_id,
        procedure_code,
        procedure_description,
        price_type,
        price_amount,
        insurance_plan,
        effective_date,
        expiration_date,
        created_at,
        updated_at,
        raw_data
    from {{ source('raw', 'hospital_prices') }}
),

cleaned_data as (
    select
        id as price_id,
        hospital_id,
        file_id,
        
        -- Standardize procedure codes
        upper(trim(procedure_code)) as procedure_code,
        trim(procedure_description) as procedure_description,
        
        -- Standardize price information
        lower(trim(price_type)) as price_type,
        
        -- Clean and validate price amounts
        case 
            when price_amount > 0 and price_amount < {{ var('max_price_threshold') }}
            then price_amount
            else null
        end as price_amount,
        
        -- Standardize insurance information
        case 
            when trim(insurance_plan) = '' then 'unspecified'
            else lower(trim(insurance_plan))
        end as insurance_plan,
        
        effective_date,
        expiration_date,
        created_at,
        updated_at,
        
        -- Data quality flags
        case 
            when procedure_code is not null and trim(procedure_code) != '' 
            then true 
            else false 
        end as has_valid_procedure_code,
        
        case 
            when price_amount > {{ var('min_price_threshold') }} 
            and price_amount < {{ var('max_price_threshold') }}
            then true 
            else false 
        end as has_valid_price,
        
        case 
            when effective_date <= current_date 
            and (expiration_date is null or expiration_date >= current_date)
            then true 
            else false 
        end as is_currently_effective,
        
        -- Extract additional fields from raw_data if needed
        case 
            when raw_data is not null 
            then raw_data::jsonb->>'department'
            else null 
        end as department,
        
        case 
            when raw_data is not null 
            then raw_data::jsonb->>'modifier'
            else null 
        end as procedure_modifier

    from source_data
    where price_amount is not null  -- Filter out records without pricing
)

select * from cleaned_data
