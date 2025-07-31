"""
Example Airflow DAG showing integration with Airbyte
This demonstrates how to trigger Airbyte syncs from Airflow workflows
"""

from datetime import datetime, timedelta
from airflow import DAG
from airflow.providers.http.operators.http import SimpleHttpOperator
from airflow.providers.http.sensors.http import HttpSensor
from airflow.operators.python import PythonOperator
from airflow.operators.bash import BashOperator
import json
import requests

# Default arguments for the DAG
default_args = {
    'owner': 'glimmr-data-team',
    'depends_on_past': False,
    'start_date': datetime(2025, 7, 30),
    'email_on_failure': False,
    'email_on_retry': False,
    'retries': 1,
    'retry_delay': timedelta(minutes=5),
}

# DAG definition
dag = DAG(
    'airbyte_integration_example',
    default_args=default_args,
    description='Example DAG showing Airbyte integration patterns',
    schedule_interval=timedelta(hours=6),  # Run every 6 hours
    catchup=False,
    tags=['airbyte', 'data-pipeline', 'example'],
)

def check_airbyte_health(**context):
    """Check if Airbyte is healthy and accessible"""
    try:
        response = requests.get('http://host.docker.internal:8000/api/v1/health', timeout=10)
        if response.status_code == 200:
            print("✅ Airbyte is healthy")
            return True
        else:
            print(f"❌ Airbyte health check failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Failed to connect to Airbyte: {str(e)}")
        return False

def get_airbyte_connections(**context):
    """Get list of Airbyte connections"""
    try:
        # Note: In production, use proper authentication
        response = requests.post(
            'http://host.docker.internal:8000/api/v1/connections/list',
            json={},
            timeout=30
        )
        
        if response.status_code == 200:
            connections = response.json().get('connections', [])
            print(f"📊 Found {len(connections)} Airbyte connections")
            
            # Store connection IDs in XCom for downstream tasks
            connection_ids = [conn['connectionId'] for conn in connections]
            return connection_ids
        else:
            print(f"❌ Failed to get connections: {response.status_code}")
            return []
    except Exception as e:
        print(f"❌ Error getting connections: {str(e)}")
        return []

def trigger_airbyte_sync(connection_id, **context):
    """Trigger a sync for a specific Airbyte connection"""
    try:
        payload = {
            "connectionId": connection_id,
            "jobType": "sync"
        }
        
        response = requests.post(
            'http://host.docker.internal:8000/api/v1/jobs',
            json=payload,
            timeout=30
        )
        
        if response.status_code == 200:
            job_data = response.json()
            job_id = job_data.get('jobId')
            print(f"✅ Triggered sync for connection {connection_id}, job ID: {job_id}")
            return job_id
        else:
            print(f"❌ Failed to trigger sync: {response.status_code}")
            raise Exception(f"Sync trigger failed: {response.status_code}")
    except Exception as e:
        print(f"❌ Error triggering sync: {str(e)}")
        raise

def wait_for_sync_completion(job_id, **context):
    """Wait for Airbyte sync to complete"""
    import time
    max_wait_time = 3600  # 1 hour max wait
    check_interval = 30   # Check every 30 seconds
    elapsed_time = 0
    
    while elapsed_time < max_wait_time:
        try:
            response = requests.get(
                f'http://host.docker.internal:8000/api/v1/jobs/{job_id}',
                timeout=10
            )
            
            if response.status_code == 200:
                job_data = response.json()
                status = job_data.get('status')
                
                if status == 'succeeded':
                    print(f"✅ Sync job {job_id} completed successfully")
                    return True
                elif status == 'failed':
                    print(f"❌ Sync job {job_id} failed")
                    raise Exception(f"Sync job failed: {job_id}")
                elif status in ['pending', 'running']:
                    print(f"⏳ Sync job {job_id} is {status}, waiting...")
                    time.sleep(check_interval)
                    elapsed_time += check_interval
                else:
                    print(f"❓ Unknown job status: {status}")
                    time.sleep(check_interval)
                    elapsed_time += check_interval
            else:
                print(f"❌ Failed to get job status: {response.status_code}")
                time.sleep(check_interval)
                elapsed_time += check_interval
                
        except Exception as e:
            print(f"❌ Error checking job status: {str(e)}")
            time.sleep(check_interval)
            elapsed_time += check_interval
    
    raise Exception(f"Sync job {job_id} timed out after {max_wait_time} seconds")

# Task 1: Health check
health_check = PythonOperator(
    task_id='check_airbyte_health',
    python_callable=check_airbyte_health,
    dag=dag,
)

# Task 2: Get connections
get_connections = PythonOperator(
    task_id='get_airbyte_connections',
    python_callable=get_airbyte_connections,
    dag=dag,
)

# Task 3: Example sync trigger (you would replace this with your actual connection ID)
# In practice, you'd get this from the previous task or configure it as a variable
example_sync = PythonOperator(
    task_id='trigger_example_sync',
    python_callable=lambda **context: print("📝 Replace this with actual connection ID from your Airbyte setup"),
    dag=dag,
)

# Task 4: Data quality check (example)
data_quality_check = BashOperator(
    task_id='data_quality_check',
    bash_command="""
    echo "🔍 Running data quality checks..."
    echo "✅ Data quality checks passed"
    # Add your actual data quality checks here
    # Example: python /opt/airflow/scripts/data_quality_check.py
    """,
    dag=dag,
)

# Task 5: Send notification
send_notification = BashOperator(
    task_id='send_notification',
    bash_command="""
    echo "📧 Sending pipeline completion notification..."
    echo "✅ Data pipeline completed successfully"
    # Add your notification logic here (Slack, email, etc.)
    """,
    dag=dag,
)

# Define task dependencies
health_check >> get_connections >> example_sync >> data_quality_check >> send_notification

# Alternative pattern for dynamic connection syncing:
# You can create dynamic tasks based on the connections found
# This would be done using Airflow's dynamic task mapping or TaskGroup

# ============================================================================
# dbt Integration Tasks
# ============================================================================

def run_dbt_command(command, **context):
    """Run dbt commands in the dbt container"""
    import subprocess

    # Build the docker command to run dbt
    docker_cmd = [
        'docker', 'compose',
        '-f', '/opt/airflow/dags/../../dbt/docker-compose.yml',
        'run', '--rm', 'dbt',
        'dbt', command
    ]

    try:
        result = subprocess.run(
            docker_cmd,
            capture_output=True,
            text=True,
            timeout=1800  # 30 minutes timeout
        )

        if result.returncode == 0:
            print(f"✅ dbt {command} completed successfully")
            print(result.stdout)
            return True
        else:
            print(f"❌ dbt {command} failed")
            print(result.stderr)
            raise Exception(f"dbt {command} failed: {result.stderr}")

    except subprocess.TimeoutExpired:
        print(f"❌ dbt {command} timed out")
        raise Exception(f"dbt {command} timed out after 30 minutes")
    except Exception as e:
        print(f"❌ Error running dbt {command}: {str(e)}")
        raise

# dbt tasks
dbt_deps = PythonOperator(
    task_id='dbt_deps',
    python_callable=lambda **context: run_dbt_command('deps', **context),
    dag=dag,
)

dbt_run_staging = PythonOperator(
    task_id='dbt_run_staging',
    python_callable=lambda **context: run_dbt_command('run --models staging', **context),
    dag=dag,
)

dbt_test_staging = PythonOperator(
    task_id='dbt_test_staging',
    python_callable=lambda **context: run_dbt_command('test --models staging', **context),
    dag=dag,
)

dbt_run_marts = PythonOperator(
    task_id='dbt_run_marts',
    python_callable=lambda **context: run_dbt_command('run --models marts', **context),
    dag=dag,
)

dbt_test_marts = PythonOperator(
    task_id='dbt_test_marts',
    python_callable=lambda **context: run_dbt_command('test --models marts', **context),
    dag=dag,
)

# Update task dependencies to include dbt
health_check >> get_connections >> example_sync >> dbt_deps >> dbt_run_staging >> dbt_test_staging >> dbt_run_marts >> dbt_test_marts >> data_quality_check >> send_notification
