import io
import uuid

from django.core.files.base import ContentFile
from PIL import Image, ImageOps, UnidentifiedImageError
from rest_framework import serializers

MAX_UPLOAD_BYTES = 5 * 1024 * 1024
MAX_PIXELS = 24_000_000


def prepare_profile_photo(upload):
    if upload.size > MAX_UPLOAD_BYTES:
        raise serializers.ValidationError({"photo": "Choose an image under 5 MB."})
    try:
        with Image.open(upload) as source:
            if source.format not in {"JPEG", "PNG", "WEBP"}:
                raise serializers.ValidationError({"photo": "Use a JPEG, PNG or WebP image."})
            width, height = source.size
            if width < 256 or height < 256 or width * height > MAX_PIXELS:
                raise serializers.ValidationError(
                    {"photo": "Use an image at least 256 × 256 pixels and no larger than 24 megapixels."}
                )
            image = ImageOps.exif_transpose(source).convert("RGB")
            image.thumbnail((1200, 1200), Image.Resampling.LANCZOS)
            output = io.BytesIO()
            image.save(output, format="WEBP", quality=84, method=6)
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError) as error:
        raise serializers.ValidationError({"photo": "Choose a valid image file."}) from error
    return f"{uuid.uuid4().hex}.webp", ContentFile(output.getvalue())
