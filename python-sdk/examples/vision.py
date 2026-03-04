"""
Vision/Multimodal Example

Demonstrates image understanding with Venice's vision models.
"""

import base64
from pathlib import Path

from venice import Venice
from venice.types import ImageContent

client = Venice()

# Analyze image from URL
print("Image Analysis (URL):")
print("-" * 40)

response = client.chat.completions.create(
    model="qwen3-vl-235b-a22b",  # Vision model
    messages=[
        {
            "role": "user",
            "content": [
                {"type": "text", "text": "Describe this image in detail."},
                {
                    "type": "image_url",
                    "image_url": {
                        "url": "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Cat03.jpg/1200px-Cat03.jpg"
                    },
                },
            ],
        },
    ],
)

print(response.content)


# With typed helper
print("\n\nUsing typed helpers:")
print("-" * 40)

image = ImageContent.from_url(
    "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b6/Image_created_with_a_mobile_phone.png/1200px-Image_created_with_a_mobile_phone.png"
)

response = client.chat.completions.create(
    model="qwen3-vl-235b-a22b",
    messages=[
        {
            "role": "user",
            "content": [
                {"type": "text", "text": "What objects can you see in this image?"},
                image.__dict__,
            ],
        },
    ],
)

print(response.content)


# Base64 encoded image (for local files)
def analyze_local_image(image_path: str):
    """Analyze a local image file."""
    path = Path(image_path)
    if not path.exists():
        print(f"Image not found: {image_path}")
        return
    
    # Read and encode
    with open(path, "rb") as f:
        image_data = base64.b64encode(f.read()).decode()
    
    # Determine media type
    suffix = path.suffix.lower()
    media_types = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".gif": "image/gif",
        ".webp": "image/webp",
    }
    media_type = media_types.get(suffix, "image/png")
    
    response = client.chat.completions.create(
        model="qwen3-vl-235b-a22b",
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": "Describe this image."},
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:{media_type};base64,{image_data}"
                        },
                    },
                ],
            },
        ],
    )
    
    return response.content


# Example usage (uncomment with a real path):
# print(analyze_local_image("path/to/image.jpg"))
