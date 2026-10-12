import hashlib
import json
import os


FHIR_RESOURCE_TYPES = {
    "Patient",
    "AllergyIntolerance",
    "Condition",
    "MedicationStatement",
    "MedicationRequest",
    "Observation",
    "DiagnosticReport",
}


def build_fhir_bundle(resources: list[dict], patient_wallet: str, record_id: int) -> dict:
    entries = []
    for index, resource in enumerate(resources):
        resource_type = resource.get("resourceType")
        if resource_type not in FHIR_RESOURCE_TYPES:
            raise ValueError(f"Unsupported FHIR resource type: {resource_type}")
        normalized = dict(resource)
        normalized.setdefault("id", f"record-{record_id}-{index}")
        entries.append({"fullUrl": f"urn:uuid:{normalized['id']}", "resource": normalized})

    return {
        "resourceType": "Bundle",
        "type": "collection",
        "identifier": {"system": "urn:medchain:record", "value": str(record_id)},
        "subject": {"reference": f"Patient/{patient_wallet}"},
        "entry": entries,
    }


def create_clinical_commitment(bundle: dict) -> str:
    salt = os.getenv("MEDCHAIN_COMMITMENT_SALT", "development-only-commitment-salt")
    payload = json.dumps(bundle, sort_keys=True, separators=(",", ":"))
    digest = hashlib.sha256(f"{salt}:{payload}".encode("utf-8")).hexdigest()
    return f"0x{digest}"