from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.users.permissions import IsActivePatient

from .ipfs import upload_encrypted_file


class UploadEncryptedToIpfsView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsActivePatient]

    def post(self, request):
        uploaded_file = request.FILES.get("file")
        if not uploaded_file:
            return Response({"detail": "A PDF file is required"}, status=status.HTTP_400_BAD_REQUEST)
        try:
            cid = upload_encrypted_file(uploaded_file.read(), uploaded_file.name)
        except RuntimeError as error:
            return Response({"detail": str(error)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        return Response({"ipfs_hash": cid, "encrypted_key_ref": "ipfs-managed"})
