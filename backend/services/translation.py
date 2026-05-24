import logging
from typing import Optional

import boto3

from config import settings

logger = logging.getLogger(__name__)


class TranslationService:
    def __init__(self):
        self.provider = (getattr(settings, "TRANSLATION_PROVIDER", "none") or "none").lower()
        self._aws_client = None
        if self.provider == "aws_translate":
            self._aws_client = boto3.client("translate", region_name=getattr(settings, "AWS_REGION", "us-east-1"))

    def translate(self, text: str, target_language: str, source_language: Optional[str] = "auto") -> str:
        if self.provider != "aws_translate":
            raise RuntimeError("Enterprise translation provider is not configured. Set TRANSLATION_PROVIDER=aws_translate")

        src = source_language if source_language and source_language != "auto" else "auto"
        result = self._aws_client.translate_text(
            Text=text,
            SourceLanguageCode=src,
            TargetLanguageCode=target_language,
        )
        return result.get("TranslatedText", text)


translation_service = TranslationService()
