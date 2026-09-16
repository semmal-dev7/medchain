import json
import os
from pathlib import Path

from eth_utils import is_address, to_checksum_address
from web3 import Web3


ROLE_DOCTOR = 2


class ChainService:
    """
    Contract read service for PatientPrivacy.

    Set `CHAIN_ENFORCEMENT=true` and configure:
    - `CHAIN_RPC_URL`
    - `PATIENT_PRIVACY_CONTRACT`
    """

    def __init__(self):
        self.enforced = os.getenv("CHAIN_ENFORCEMENT", "false").lower() == "true"
        self.rpc_url = os.getenv("CHAIN_RPC_URL", "")
        self.contract_address = os.getenv("PATIENT_PRIVACY_CONTRACT", "")
        self.web3 = Web3(Web3.HTTPProvider(self.rpc_url)) if self.rpc_url else None
        self.contract = self._build_contract()

    def assert_doctor_can_request(self, record_id: int, doctor_wallet: str) -> bool:
        if not self.enforced:
            return True

        doctor = self._to_checksum(doctor_wallet)
        if not doctor or not self._record_exists(record_id):
            return False

        try:
            role = self.contract.functions.getRole(doctor).call()
            is_suspended = self.contract.functions.suspendedUsers(doctor).call()
            return role == ROLE_DOCTOR and not is_suspended
        except Exception:
            return False

    def assert_patient_owns_record(self, record_id: int, patient_wallet: str) -> bool:
        if not self.enforced:
            return True

        patient = self._to_checksum(patient_wallet)
        if not patient or not self._record_exists(record_id):
            return False

        try:
            record = self.contract.functions.records(record_id).call()
            owner = record[0]
            return owner.lower() == patient.lower()
        except Exception:
            return False

    def assert_access_active(self, record_id: int, doctor_wallet: str) -> bool:
        if not self.enforced:
            return True

        doctor = self._to_checksum(doctor_wallet)
        if not doctor:
            return False

        try:
            return bool(self.contract.functions.hasAccess(record_id, doctor).call())
        except Exception:
            return False

    def _record_exists(self, record_id: int) -> bool:
        try:
            total = self.contract.functions.recordCount().call()
            return 0 <= record_id < int(total)
        except Exception:
            return False

    def _build_contract(self):
        if not self.enforced:
            return None
        if not self.web3 or not self.web3.is_connected():
            return None
        address = self._to_checksum(self.contract_address)
        if not address:
            return None

        abi = self._load_contract_abi()
        if not abi:
            return None
        return self.web3.eth.contract(address=address, abi=abi)

    @staticmethod
    def _to_checksum(wallet: str):
        if not wallet or not is_address(wallet):
            return None
        return to_checksum_address(wallet)

    @staticmethod
    def _load_contract_abi():
        project_root = Path(__file__).resolve().parents[3]
        artifact_path = project_root / "artifacts" / "contracts" / "PatientPrivacy.sol" / "PatientPrivacy.json"
        if not artifact_path.exists():
            return None
        try:
            with artifact_path.open("r", encoding="utf-8") as f:
                artifact = json.load(f)
            return artifact.get("abi")
        except Exception:
            return None
