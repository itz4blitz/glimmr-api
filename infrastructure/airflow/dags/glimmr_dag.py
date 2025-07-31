# Glimmr Healthcare Data Processing DAG
from datetime import datetime, timedelta
from airflow import DAG
from airflow.operators.bash import BashOperator
from airflow.operators.python import PythonOperator

default_args = {
    'owner': 'glimmr',
    'depends_on_past': False,
    'start_date': datetime(2024, 1, 1),
    'email_on_failure': False,
    'email_on_retry': False,
    'retries': 1,
    'retry_delay': timedelta(minutes=5),
}

dag = DAG(
    'glimmr_data_processing',
    default_args=default_args,
    description='Glimmr healthcare price transparency processing',
    schedule_interval=timedelta(hours=6),
    catchup=False,
    tags=['healthcare', 'glimmr'],
)

def hello_glimmr():
    """Simple hello function for DAG testing"""
    print("Hello from Glimmr Healthcare Platform!")
    return "success"

# Simple task for production deployment testing
hello_task = PythonOperator(
    task_id='hello_glimmr',
    python_callable=hello_glimmr,
    dag=dag,
)

# Health check task
health_check = BashOperator(
    task_id='health_check',
    bash_command='echo "Glimmr DAG is healthy and running"',
    dag=dag,
)

hello_task >> health_check