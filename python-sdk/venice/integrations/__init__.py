"""
Venice AI Framework Integrations

Drop-in integrations for popular AI frameworks.
"""

from .langchain import (
    VeniceChatModel,
    VeniceEmbeddings,
)

__all__ = [
    "VeniceChatModel",
    "VeniceEmbeddings",
]
