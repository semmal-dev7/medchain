import json
import os
import uuid
from urllib import error, request

from .encryption import encrypt_file


def upload_encrypted_file(contents: bytes, file_name: str) -> str:
    endpoint = os.getenv("IPFS_API_URL", "").strip()
    token = os.getenv("IPFS_API_TOKEN", "").strip()
    if not endpoint:
        raise RuntimeError("IPFS_API_URL is not configured")
    if not token:
        raise RuntimeError("IPFS_API_TOKEN is not configured")

    boundary = f"----medchain-{uuid.uuid4().hex}"
    payload = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="file"; filename="{file_name}.enc"\r\n'
        "Content-Type: application/octet-stream\r\n\r\n"
    ).encode() + encrypt_file(contents) + f"\r\n--{boundary}--\r\n".encode()
    is_pinata = endpoint.rstrip("/") == "https://api.pinata.cloud"
    upload_path = "/pinning/pinFileToIPFS" if is_pinata else "/api/v0/add?pin=true"
    headers = {"Content-Type": f"multipart/form-data; boundary={boundary}"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    ipfs_request = request.Request(
        endpoint.rstrip("/") + upload_path,
        data=payload,
        headers=headers,
        method="POST",
    )
    try:
        with request.urlopen(ipfs_request, timeout=30) as response:
            result = json.loads(response.read().decode("utf-8"))
    except error.HTTPError as upload_error:
        if upload_error.code == 403:
            raise RuntimeError(
                "Pinata rejected the upload. Create a JWT with pinFileToIPFS permission."
            ) from upload_error
        raise RuntimeError(
            f"IPFS upload failed with HTTP {upload_error.code}"
        ) from upload_error
    except Exception as upload_error:
        raise RuntimeError("The encrypted file could not be uploaded to IPFS") from upload_error

    cid = result.get("IpfsHash") if is_pinata else result.get("Hash")
    if not cid:
        raise RuntimeError("IPFS did not return a content identifier")
    return f"ipfs://{cid}"
