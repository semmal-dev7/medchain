// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

contract PatientPrivacy {
    enum Role {
        None,
        Patient,
        Doctor,
        Admin
    }

    enum RequestStatus {
        None,
        Pending,
        Approved,
        Rejected,
        Revoked
    }

    error InvalidIpfsHash();
    error InvalidDoctorAddress();
    error InvalidRecordId(uint256 recordId);
    error NotRecordOwner(uint256 recordId);
    error AccessNotGranted(uint256 recordId, address doctor);
    error AccessDenied(uint256 recordId, address user);
    error AlreadyRegistered(address user);
    error NotPatient(address user);
    error NotDoctor(address user);
    error NotAdmin(address user);
    error UserIsSuspended(address user);
    error AccessRequestNotPending(uint256 recordId, address doctor);
    error AccessRequestAlreadyOpen(uint256 recordId, address doctor);

    struct Record {
        address owner;
        string ipfsHash;
        uint64 createdAt;
        bool active;
    }

    struct AccessRequest {
        RequestStatus status;
        uint64 requestedAt;
        uint64 updatedAt;
    }

    mapping(uint256 => Record) public records;
    mapping(uint256 => mapping(address => bool)) private accessList;
    mapping(address => uint256[]) private patientRecords;
    mapping(address => Role) private roles;
    mapping(address => bool) public suspendedUsers;
    mapping(uint256 => mapping(address => AccessRequest)) private accessRequests;

    uint256 public recordCount;

    event PatientRegistered(address indexed patient);
    event DoctorRegistered(address indexed doctor);
    event UserSuspended(address indexed user, bool suspended, address indexed admin);
    event RecordCreated(
        uint256 indexed recordId,
        address indexed owner,
        string ipfsHash,
        uint256 createdAt
    );
    event AccessRequested(
        uint256 indexed recordId,
        address indexed doctor,
        address indexed patient,
        uint256 timestamp
    );
    event AccessApproved(
        uint256 indexed recordId,
        address indexed patient,
        address indexed doctor,
        uint256 timestamp
    );
    event AccessRejected(
        uint256 indexed recordId,
        address indexed patient,
        address indexed doctor,
        uint256 timestamp
    );
    event AccessRevoked(
        uint256 indexed recordId,
        address indexed patient,
        address indexed doctor,
        uint256 timestamp
    );

    constructor() {
        roles[msg.sender] = Role.Admin;
    }

    modifier validRecord(uint256 recordId) {
        if (recordId >= recordCount) revert InvalidRecordId(recordId);
        _;
    }

    modifier onlyRecordOwner(uint256 recordId) {
        if (records[recordId].owner != msg.sender) revert NotRecordOwner(recordId);
        _;
    }

    modifier onlyPatient() {
        if (roles[msg.sender] != Role.Patient) revert NotPatient(msg.sender);
        _;
    }

    modifier onlyDoctor() {
        if (roles[msg.sender] != Role.Doctor) revert NotDoctor(msg.sender);
        _;
    }

    modifier onlyAdmin() {
        if (roles[msg.sender] != Role.Admin) revert NotAdmin(msg.sender);
        _;
    }

    modifier notSuspended() {
        if (suspendedUsers[msg.sender]) revert UserIsSuspended(msg.sender);
        _;
    }

    function registerPatient() external notSuspended {
        if (roles[msg.sender] != Role.None) revert AlreadyRegistered(msg.sender);
        roles[msg.sender] = Role.Patient;
        emit PatientRegistered(msg.sender);
    }

    function registerDoctor() external notSuspended {
        if (roles[msg.sender] != Role.None) revert AlreadyRegistered(msg.sender);
        roles[msg.sender] = Role.Doctor;
        emit DoctorRegistered(msg.sender);
    }

    function setUserSuspension(address user, bool suspended)
        external
        onlyAdmin
    {
        suspendedUsers[user] = suspended;
        emit UserSuspended(user, suspended, msg.sender);
    }

    function createRecord(string memory ipfsHash)
        external
        onlyPatient
        notSuspended
        returns (uint256)
    {
        if (bytes(ipfsHash).length == 0) revert InvalidIpfsHash();

        uint256 id = recordCount;
        records[id] = Record({
            owner: msg.sender,
            ipfsHash: ipfsHash,
            createdAt: uint64(block.timestamp),
            active: true
        });
        patientRecords[msg.sender].push(id);
        recordCount++;
        emit RecordCreated(id, msg.sender, ipfsHash, block.timestamp);
        return id;
    }

    function requestAccess(uint256 recordId)
        external
        onlyDoctor
        notSuspended
        validRecord(recordId)
    {
        AccessRequest storage req = accessRequests[recordId][msg.sender];
        if (
            req.status == RequestStatus.Pending ||
            req.status == RequestStatus.Approved
        ) revert AccessRequestAlreadyOpen(recordId, msg.sender);

        req.status = RequestStatus.Pending;
        req.requestedAt = uint64(block.timestamp);
        req.updatedAt = uint64(block.timestamp);
        emit AccessRequested(
            recordId,
            msg.sender,
            records[recordId].owner,
            block.timestamp
        );
    }

    function approveAccess(uint256 recordId, address doctor)
        public
        validRecord(recordId)
        onlyRecordOwner(recordId)
        notSuspended
    {
        _validateDoctorForOwnerAction(doctor);
        AccessRequest storage req = accessRequests[recordId][doctor];
        if (req.status != RequestStatus.Pending) {
            revert AccessRequestNotPending(recordId, doctor);
        }

        accessList[recordId][doctor] = true;
        req.status = RequestStatus.Approved;
        req.updatedAt = uint64(block.timestamp);
        emit AccessApproved(recordId, msg.sender, doctor, block.timestamp);
    }

    function grantAccess(uint256 recordId, address doctor) external {
        approveAccess(recordId, doctor);
    }

    function rejectAccess(uint256 recordId, address doctor)
        external
        validRecord(recordId)
        onlyRecordOwner(recordId)
        notSuspended
    {
        _validateDoctorForOwnerAction(doctor);
        AccessRequest storage req = accessRequests[recordId][doctor];
        if (req.status != RequestStatus.Pending) {
            revert AccessRequestNotPending(recordId, doctor);
        }

        accessList[recordId][doctor] = false;
        req.status = RequestStatus.Rejected;
        req.updatedAt = uint64(block.timestamp);
        emit AccessRejected(recordId, msg.sender, doctor, block.timestamp);
    }

    function revokeAccess(uint256 recordId, address doctor)
        external
        validRecord(recordId)
        onlyRecordOwner(recordId)
        notSuspended
    {
        _validateDoctorForOwnerAction(doctor);
        if (!accessList[recordId][doctor]) {
            revert AccessNotGranted(recordId, doctor);
        }

        accessList[recordId][doctor] = false;
        AccessRequest storage req = accessRequests[recordId][doctor];
        req.status = RequestStatus.Revoked;
        req.updatedAt = uint64(block.timestamp);
        emit AccessRevoked(recordId, msg.sender, doctor, block.timestamp);
    }

    function hasAccess(uint256 recordId, address user)
        public
        view
        validRecord(recordId)
        returns (bool)
    {
        return records[recordId].owner == user || accessList[recordId][user];
    }

    function getRecord(uint256 recordId)
        external
        view
        validRecord(recordId)
        returns (Record memory)
    {
        if (suspendedUsers[msg.sender]) revert UserIsSuspended(msg.sender);
        if (!hasAccess(recordId, msg.sender)) revert AccessDenied(recordId, msg.sender);
        return records[recordId];
    }

    function getPatientRecordIds(address patient)
        external
        view
        returns (uint256[] memory)
    {
        return patientRecords[patient];
    }

    function getRole(address user) external view returns (Role) {
        return roles[user];
    }

    function getAccessRequestStatus(uint256 recordId, address doctor)
        external
        view
        validRecord(recordId)
        returns (RequestStatus status, uint64 requestedAt, uint64 updatedAt)
    {
        AccessRequest memory req = accessRequests[recordId][doctor];
        return (req.status, req.requestedAt, req.updatedAt);
    }

    function _validateDoctorForOwnerAction(address doctor) private view {
        if (
            doctor == address(0) ||
            doctor == msg.sender ||
            roles[doctor] != Role.Doctor ||
            suspendedUsers[doctor]
        ) {
            revert InvalidDoctorAddress();
        }
    }
}
