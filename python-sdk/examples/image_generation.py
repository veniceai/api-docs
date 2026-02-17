"""
Image Generation Example

Demonstrates Venice's image generation, editing, and upscaling capabilities.
"""

from venice import Venice

client = Venice()

# Generate an image
print("Generating image...")
print("-" * 40)

result = client.images.generate(
    prompt="A serene mountain landscape at sunset with a lake reflection",
    model="fluently-xl",
    n=1,
    size="1024x1024",
    quality="standard",
    # Venice-specific options
    negative_prompt="blurry, low quality, distorted",
    cfg_scale=7.5,
    steps=30,
    seed=42,  # For reproducibility
    safe_mode=True,
)

print(f"Image URL: {result.data[0].url}")
if result.data[0].revised_prompt:
    print(f"Revised prompt: {result.data[0].revised_prompt}")


# Different sizes
print("\n\nDifferent aspect ratios:")
print("-" * 40)

for size in ["1024x1024", "1792x1024", "1024x1792"]:
    result = client.images.generate(
        prompt="A futuristic city skyline",
        model="fluently-xl",
        size=size,
    )
    print(f"{size}: {result.data[0].url}")


# Get as base64 instead of URL
print("\n\nAs base64:")
print("-" * 40)

result = client.images.generate(
    prompt="A cute robot",
    model="fluently-xl",
    response_format="b64_json",
)

if result.data[0].b64_json:
    print(f"Got {len(result.data[0].b64_json)} bytes of base64 data")
    # You can decode and save:
    # import base64
    # with open("robot.png", "wb") as f:
    #     f.write(base64.b64decode(result.data[0].b64_json))


# Image upscaling
print("\n\nImage upscaling:")
print("-" * 40)

# First generate a small image
small = client.images.generate(
    prompt="A detailed flower",
    model="fluently-xl",
    size="512x512",
)

# Then upscale it
# upscaled = client.images.upscale(
#     image=small.data[0].url,  # or base64
#     model="real-esrgan-4x",
#     scale=4,
# )
# print(f"Upscaled URL: {upscaled.data[0].url}")

print("(Upscaling example - uncomment to run)")
