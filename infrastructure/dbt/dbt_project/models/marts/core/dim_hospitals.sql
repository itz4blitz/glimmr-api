{{
  config(
    materialized='table',
    description='Hospital dimension table with comprehensive hospital information'
  )
}}

-- Hospital dimension table
-- This model creates a clean, comprehensive view of all hospitals

with hospital_base as (
    select
        id as hospital_id,
        name as hospital_name,
        address,
        city,
        state,
        zip_code,
        phone,
        website,
        hospital_type,
        bed_count,
        ownership_type,
        created_at,
        updated_at
    from {{ source('raw', 'hospitals') }}
),

hospital_metrics as (
    select
        hospital_id,
        count(distinct file_id) as total_files_processed,
        count(distinct case when is_processed then file_id end) as successful_files,
        max(processed_at) as last_file_processed_at,
        min(extracted_at) as first_file_extracted_at
    from {{ ref('stg_hospital_pricing_files') }}
    group by hospital_id
),

hospital_pricing_stats as (
    select
        hospital_id,
        count(*) as total_price_records,
        count(distinct procedure_code) as unique_procedures,
        count(distinct insurance_plan) as unique_insurance_plans,
        avg(price_amount) as avg_price,
        min(price_amount) as min_price,
        max(price_amount) as max_price,
        count(case when has_valid_price then 1 end) as valid_price_records,
        count(case when is_currently_effective then 1 end) as current_price_records
    from {{ ref('stg_hospital_prices') }}
    group by hospital_id
),

final as (
    select
        h.hospital_id,
        h.hospital_name,
        h.address,
        h.city,
        h.state,
        h.zip_code,
        h.phone,
        h.website,
        h.hospital_type,
        h.bed_count,
        h.ownership_type,
        
        -- File processing metrics
        coalesce(hm.total_files_processed, 0) as total_files_processed,
        coalesce(hm.successful_files, 0) as successful_files,
        hm.last_file_processed_at,
        hm.first_file_extracted_at,
        
        -- Pricing data metrics
        coalesce(hps.total_price_records, 0) as total_price_records,
        coalesce(hps.unique_procedures, 0) as unique_procedures,
        coalesce(hps.unique_insurance_plans, 0) as unique_insurance_plans,
        hps.avg_price,
        hps.min_price,
        hps.max_price,
        coalesce(hps.valid_price_records, 0) as valid_price_records,
        coalesce(hps.current_price_records, 0) as current_price_records,
        
        -- Data quality metrics
        case 
            when hm.successful_files > 0 then 
                round((hm.successful_files::numeric / hm.total_files_processed::numeric) * 100, 2)
            else 0 
        end as file_success_rate_pct,
        
        case 
            when hps.total_price_records > 0 then 
                round((hps.valid_price_records::numeric / hps.total_price_records::numeric) * 100, 2)
            else 0 
        end as price_data_quality_pct,
        
        -- Status flags
        case 
            when hm.total_files_processed > 0 then true 
            else false 
        end as has_processed_files,
        
        case 
            when hps.current_price_records > 0 then true 
            else false 
        end as has_current_pricing,
        
        h.created_at,
        h.updated_at,
        current_timestamp as dbt_updated_at
        
    from hospital_base h
    left join hospital_metrics hm on h.hospital_id = hm.hospital_id
    left join hospital_pricing_stats hps on h.hospital_id = hps.hospital_id
)

select * from final
