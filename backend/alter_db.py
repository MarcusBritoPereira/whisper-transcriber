import sys
sys.path.append('.')
from sqlalchemy import create_engine, text
from config import settings

engine = create_engine(settings.get_database_url)
with engine.connect() as conn:
    try:
        conn.execute(text('ALTER TABLE jobs ADD COLUMN workspace_id VARCHAR(50);'))
        conn.commit()
        print('Added workspace_id!')
    except Exception as e:
        print('Error workspace_id:', e)
        conn.rollback()
        
    try:
        conn.execute(text('ALTER TABLE jobs ADD COLUMN folder_id VARCHAR(50);'))
        conn.commit()
        print('Added folder_id!')
    except Exception as e:
        print('Error folder_id:', e)
        conn.rollback()
