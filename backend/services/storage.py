import os
import boto3
from botocore.exceptions import ClientError
from config import settings
from typing import Optional
import logging

logger = logging.getLogger(__name__)

# Initialize S3 Client
s3_client = boto3.client(
    "s3",
    endpoint_url=settings.S3_ENDPOINT_URL,
    aws_access_key_id=settings.S3_ACCESS_KEY_ID,
    aws_secret_access_key=settings.S3_SECRET_ACCESS_KEY,
    region_name=settings.S3_REGION_NAME,
)

BUCKET_NAME = settings.S3_BUCKET_NAME


def ensure_bucket_exists() -> None:
    try:
        s3_client.head_bucket(Bucket=BUCKET_NAME)
        logger.info(f"S3/MinIO bucket '{BUCKET_NAME}' already exists.")
    except ClientError as e:
        error_code = e.response["Error"]["Code"]
        if error_code == "404":
            try:
                # If local MinIO or us-east-1, LocationConstraint shouldn't be passed, or handled gracefully
                if settings.S3_ENDPOINT_URL or settings.S3_REGION_NAME == "us-east-1":
                    s3_client.create_bucket(Bucket=BUCKET_NAME)
                else:
                    s3_client.create_bucket(
                        Bucket=BUCKET_NAME,
                        CreateBucketConfiguration={"LocationConstraint": settings.S3_REGION_NAME},
                    )
                logger.info(f"S3/MinIO bucket '{BUCKET_NAME}' created successfully.")
            except Exception as create_err:
                logger.error(f"Failed to create S3 bucket '{BUCKET_NAME}': {create_err}")
        else:
            logger.error(f"Error head-checking S3 bucket '{BUCKET_NAME}': {e}")


def upload_file(local_path: str, s3_key: str) -> Optional[str]:
    try:
        s3_client.upload_file(local_path, BUCKET_NAME, s3_key)
        logger.info(f"Uploaded {local_path} to S3 bucket {BUCKET_NAME}/{s3_key}")
        return s3_key
    except Exception as e:
        logger.error(f"Failed to upload {local_path} to S3: {e}")
        return None


def download_file(s3_key: str, local_path: str) -> bool:
    try:
        os.makedirs(os.path.dirname(local_path), exist_ok=True)
        s3_client.download_file(BUCKET_NAME, s3_key, local_path)
        logger.info(f"Downloaded {s3_key} from S3 to {local_path}")
        return True
    except Exception as e:
        logger.error(f"Failed to download {s3_key} from S3: {e}")
        return False


def generate_presigned_upload_url(s3_key: str, expires_in: int = 3600) -> Optional[str]:
    try:
        url = s3_client.generate_presigned_url(
            "put_object",
            Params={"Bucket": BUCKET_NAME, "Key": s3_key},
            ExpiresIn=expires_in,
        )
        return url
    except Exception as e:
        logger.error(f"Failed to generate presigned upload URL for {s3_key}: {e}")
        return None


def generate_presigned_download_url(s3_key: str, expires_in: int = 3600) -> Optional[str]:
    try:
        url = s3_client.generate_presigned_url(
            "get_object",
            Params={"Bucket": BUCKET_NAME, "Key": s3_key},
            ExpiresIn=expires_in,
        )
        return url
    except Exception as e:
        logger.error(f"Failed to generate presigned download URL for {s3_key}: {e}")
        return None


def delete_file(s3_key: str) -> bool:
    try:
        s3_client.delete_object(Bucket=BUCKET_NAME, Key=s3_key)
        logger.info(f"Deleted S3 object {BUCKET_NAME}/{s3_key}")
        return True
    except Exception as e:
        logger.error(f"Failed to delete S3 object {s3_key}: {e}")
        return False
