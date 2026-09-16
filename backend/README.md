# Django Backend (Patient Privacy)

This backend provides wallet-based auth, role profiles, records metadata APIs, and access-request orchestration.

## 1. Setup
```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

## 2. Configure
1. Copy `.env.example` to `.env`.
2. Update PostgreSQL and chain config values.

## 3. Run Migrations
```bash
python manage.py makemigrations
python manage.py migrate
python manage.py createsuperuser
```

## 4. Start Server
```bash
python manage.py runserver
```

## 5. API Endpoints (Current Scaffold)
- `POST /api/v1/auth/nonce`
- `POST /api/v1/auth/verify`
- `GET /api/v1/users/me`
- `GET /api/v1/records/mine`
- `POST /api/v1/records/`
- `POST /api/v1/access/requests`
- `GET /api/v1/access/requests/incoming`
- `GET /api/v1/access/requests/outgoing`
- `GET /api/v1/access/patient-records?wallet=0x...`
- `POST /api/v1/access/requests/<uuid>/approve`
- `POST /api/v1/access/requests/<uuid>/reject`
- `POST /api/v1/access/requests/<uuid>/revoke`

## Notes
- SIWE signature verification is implemented using message recovery and nonce matching.
- Chain checks are implemented in `apps/chain/services.py` and can be enforced with `CHAIN_ENFORCEMENT=true`.
- Write-transaction orchestration and full SIWE field validation (domain/URI/issued-at) should be tightened before production.
