"""
Venice AI Exceptions

Custom exception classes for Venice API errors.
"""

from typing import Any, Dict, Optional


class VeniceError(Exception):
    """Base exception for all Venice errors."""
    
    def __init__(self, message: str):
        self.message = message
        super().__init__(message)


class VeniceAPIError(VeniceError):
    """Error returned by the Venice API."""
    
    def __init__(
        self,
        message: str,
        status_code: Optional[int] = None,
        response: Optional[Dict[str, Any]] = None,
        request_id: Optional[str] = None,
    ):
        super().__init__(message)
        self.status_code = status_code
        self.response = response or {}
        self.request_id = request_id
    
    def __str__(self) -> str:
        parts = [self.message]
        if self.status_code:
            parts.append(f"(status={self.status_code})")
        if self.request_id:
            parts.append(f"[request_id={self.request_id}]")
        return " ".join(parts)


class VeniceAuthenticationError(VeniceAPIError):
    """Authentication failed (401)."""
    pass


class VeniceRateLimitError(VeniceAPIError):
    """Rate limit exceeded (429)."""
    
    def __init__(
        self,
        message: str = "Rate limit exceeded",
        retry_after: Optional[int] = None,
        **kwargs,
    ):
        super().__init__(message, **kwargs)
        self.retry_after = retry_after


class VeniceTimeoutError(VeniceError):
    """Request timed out."""
    pass


class VeniceConnectionError(VeniceError):
    """Connection to Venice API failed."""
    pass


class VeniceValidationError(VeniceError):
    """Request validation failed."""
    
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(message)
        self.details = details or {}


class VeniceContentFilterError(VeniceAPIError):
    """Content was filtered by safety systems."""
    pass


class VeniceModelDeprecationWarning(Warning):
    """Model is deprecated and will be removed."""
    
    def __init__(self, model: str, deprecation_date: Optional[str] = None):
        self.model = model
        self.deprecation_date = deprecation_date
        message = f"Model '{model}' is deprecated"
        if deprecation_date:
            message += f" and will be removed on {deprecation_date}"
        super().__init__(message)


def raise_for_status(response_data: Dict[str, Any], status_code: int, request_id: Optional[str] = None) -> None:
    """Raise appropriate exception based on API response."""
    error_message = response_data.get("error", "Unknown error")
    
    if isinstance(error_message, dict):
        error_message = error_message.get("message", str(error_message))
    
    kwargs = {
        "message": error_message,
        "status_code": status_code,
        "response": response_data,
        "request_id": request_id,
    }
    
    if status_code == 401:
        raise VeniceAuthenticationError(**kwargs)
    elif status_code == 429:
        raise VeniceRateLimitError(**kwargs)
    elif status_code >= 400:
        raise VeniceAPIError(**kwargs)
